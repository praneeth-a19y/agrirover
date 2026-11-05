"""Train an EPICS crop-disease classifier with TensorFlow/Keras.

Run in Google Colab with a GPU, or a local machine with TensorFlow installed:
    python train_epics_model.py

Outputs:
    plant_disease_model.keras
    class_names.json
    training_metrics.json

Dataset: TensorFlow Datasets PlantVillage (38 classes, 54,303 images).
The exported model accepts RGB image arrays in the 0..255 range at 224x224.
Preprocessing is embedded in the model to keep inference consistent.
"""

import json
import os
import random
from pathlib import Path

import numpy as np
import tensorflow as tf
import tensorflow_datasets as tfds

SEED = 42
IMAGE_SIZE = (224, 224)
BATCH_SIZE = 32
HEAD_EPOCHS = 8
FINE_TUNE_EPOCHS = 6
AUTOTUNE = tf.data.AUTOTUNE
OUTPUT_DIR = Path(".")

random.seed(SEED)
np.random.seed(SEED)
tf.random.set_seed(SEED)

print("TensorFlow:", tf.__version__)
print("GPUs:", tf.config.list_physical_devices("GPU"))
print("Loading PlantVillage from TensorFlow Datasets (first run downloads ~828 MiB)...")

records, info = tfds.load(
    "plant_village",
    split="train",
    as_supervised=False,
    with_info=True,
    shuffle_files=True,
)
CLASS_NAMES = info.features["label"].names
NUM_CLASSES = len(CLASS_NAMES)
print(f"Classes: {NUM_CLASSES}; total images: {info.splits['train'].num_examples}")

# Create deterministic, approximately stratified 80/10/10 partitions. The source
# is shuffled with a fixed seed before selecting every tenth record into splits.
shuffled = records.shuffle(12000, seed=SEED, reshuffle_each_iteration=False).enumerate()
train_records = shuffled.filter(lambda i, item: tf.math.floormod(i, 10) < 8).map(lambda i, item: item, num_parallel_calls=AUTOTUNE)
val_records = shuffled.filter(lambda i, item: tf.math.floormod(i, 10) == 8).map(lambda i, item: item, num_parallel_calls=AUTOTUNE)
test_records = shuffled.filter(lambda i, item: tf.math.floormod(i, 10) == 9).map(lambda i, item: item, num_parallel_calls=AUTOTUNE)


def prepare_record(record):
    image = tf.image.resize(record["image"], IMAGE_SIZE, antialias=True)
    image = tf.cast(image, tf.float32)  # keep pixels in 0..255; model rescales internally
    label = tf.cast(record["label"], tf.int32)
    return image, label


def make_dataset(dataset, training=False):
    dataset = dataset.map(prepare_record, num_parallel_calls=AUTOTUNE)
    if training:
        dataset = dataset.shuffle(4096, seed=SEED, reshuffle_each_iteration=True)
    return dataset.batch(BATCH_SIZE).prefetch(AUTOTUNE)

train_ds = make_dataset(train_records, training=True)
val_ds = make_dataset(val_records)
test_ds = make_dataset(test_records)

# Augmentation and pixel rescaling are inside the model; the API must pass raw
# RGB pixels (0..255) and must NOT call preprocess_input a second time.
augmentation = tf.keras.Sequential(
    [
        tf.keras.layers.RandomFlip("horizontal"),
        tf.keras.layers.RandomRotation(0.08),
        tf.keras.layers.RandomZoom(0.12),
        tf.keras.layers.RandomContrast(0.10),
    ],
    name="training_augmentation",
)

base_model = tf.keras.applications.MobileNetV2(
    input_shape=IMAGE_SIZE + (3,),
    include_top=False,
    weights="imagenet",
)
base_model.trainable = False

inputs = tf.keras.Input(shape=IMAGE_SIZE + (3,), name="leaf_rgb_0_255")
x = augmentation(inputs)
x = tf.keras.layers.Rescaling(1.0 / 127.5, offset=-1.0, name="mobilenetv2_rescale_minus1_to1")(x)
x = base_model(x, training=False)
x = tf.keras.layers.GlobalAveragePooling2D()(x)
x = tf.keras.layers.Dropout(0.30)(x)
x = tf.keras.layers.Dense(256, activation="relu")(x)
x = tf.keras.layers.Dropout(0.20)(x)
outputs = tf.keras.layers.Dense(NUM_CLASSES, activation="softmax", name="disease_probabilities")(x)
model = tf.keras.Model(inputs, outputs, name="epics_mobilenetv2_crop_disease")


def callbacks(checkpoint_path):
    return [
        tf.keras.callbacks.ModelCheckpoint(
            str(checkpoint_path), monitor="val_accuracy", mode="max", save_best_only=True, verbose=1
        ),
        tf.keras.callbacks.EarlyStopping(
            monitor="val_accuracy", mode="max", patience=3, restore_best_weights=False, verbose=1
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss", factor=0.25, patience=2, min_lr=1e-7, verbose=1
        ),
    ]

model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
    loss="sparse_categorical_crossentropy",
    metrics=["accuracy"],
)
model.summary()

phase1_path = OUTPUT_DIR / "epics_phase1_best.keras"
print("\nPhase 1/2: training the classification head...")
history_head = model.fit(
    train_ds,
    validation_data=val_ds,
    epochs=HEAD_EPOCHS,
    callbacks=callbacks(phase1_path),
)

# Fine-tune only the final MobileNetV2 layers; keep BatchNorm layers frozen for
# steadier small-data training.
print("\nPhase 2/2: fine-tuning the final MobileNetV2 layers...")
base_model.trainable = True
for layer in base_model.layers[:-30]:
    layer.trainable = False
for layer in base_model.layers:
    if isinstance(layer, tf.keras.layers.BatchNormalization):
        layer.trainable = False

model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=1e-5),
    loss="sparse_categorical_crossentropy",
    metrics=["accuracy"],
)
phase2_path = OUTPUT_DIR / "epics_phase2_best.keras"
history_fine = model.fit(
    train_ds,
    validation_data=val_ds,
    epochs=FINE_TUNE_EPOCHS,
    callbacks=callbacks(phase2_path),
)

# Select phase by validation accuracy; do not pick based on test results.
candidates = []
for candidate_path in (phase1_path, phase2_path):
    if candidate_path.exists():
        candidate = tf.keras.models.load_model(candidate_path, compile=False)
        candidate.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=1e-5),
            loss="sparse_categorical_crossentropy",
            metrics=["accuracy"],
        )
        val_loss, val_acc = candidate.evaluate(val_ds, verbose=0)
        candidates.append((float(val_acc), candidate_path, candidate, float(val_loss)))
if not candidates:
    raise RuntimeError("Training failed: no checkpoint was saved.")
best_val_acc, best_path, best_model, best_val_loss = max(candidates, key=lambda item: item[0])

final_model_path = OUTPUT_DIR / "plant_disease_model.keras"
best_model.save(final_model_path)
with open(OUTPUT_DIR / "class_names.json", "w", encoding="utf-8") as f:
    json.dump(CLASS_NAMES, f, indent=2, ensure_ascii=False)

print("\nEvaluating final selected model on held-out test data...")
test_loss, test_accuracy = best_model.evaluate(test_ds, verbose=1)
metrics = {
    "dataset": "PlantVillage via TensorFlow Datasets",
    "num_classes": NUM_CLASSES,
    "class_names": CLASS_NAMES,
    "selected_checkpoint": best_path.name,
    "validation_accuracy": best_val_acc,
    "validation_loss": best_val_loss,
    "test_accuracy": float(test_accuracy),
    "test_loss": float(test_loss),
    "image_size": list(IMAGE_SIZE),
    "input_pixel_range": "RGB 0..255; preprocessing embedded in model",
    "seed": SEED,
}
with open(OUTPUT_DIR / "training_metrics.json", "w", encoding="utf-8") as f:
    json.dump(metrics, f, indent=2, ensure_ascii=False)

print("\nTRAINING COMPLETE")
print(f"Model: {final_model_path.resolve()}")
print(f"Classes: {(OUTPUT_DIR / 'class_names.json').resolve()}")
print(f"Metrics: {(OUTPUT_DIR / 'training_metrics.json').resolve()}")
print(f"Validation accuracy: {best_val_acc:.4f}")
print(f"Held-out test accuracy: {test_accuracy:.4f}")
print("Download plant_disease_model.keras and class_names.json for the Antigravity backend.")
print("Note: PlantVillage images mostly have controlled backgrounds; validate with real rover photos before relying on predictions in the field.")
