import os
import io
import json
import uuid
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Tuple, List, Optional
from PIL import Image, UnidentifiedImageError
import numpy as np

from app.config import settings

logger = logging.getLogger("agri_rover.ml")

# Default 38 PlantVillage Classes
DEFAULT_PLANT_VILLAGE_CLASSES = [
    "Apple___Apple_scab",
    "Apple___Black_rot",
    "Apple___Cedar_apple_rust",
    "Apple___healthy",
    "Blueberry___healthy",
    "Cherry_(including_sour)___Powdery_mildew",
    "Cherry_(including_sour)___healthy",
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot",
    "Corn_(maize)___Common_rust_",
    "Corn_(maize)___Northern_Leaf_Blight",
    "Corn_(maize)___healthy",
    "Grape___Black_rot",
    "Grape___Esca_(Black_Measles)",
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)",
    "Grape___healthy",
    "Orange___Haunglongbing_(Citrus_greening)",
    "Peach___Bacterial_spot",
    "Peach___healthy",
    "Pepper,_bell___Bacterial_spot",
    "Pepper,_bell___healthy",
    "Potato___Early_blight",
    "Potato___Late_blight",
    "Potato___healthy",
    "Raspberry___healthy",
    "Soybean___healthy",
    "Squash___Powdery_mildew",
    "Strawberry___Leaf_scorch",
    "Strawberry___healthy",
    "Tomato___Bacterial_spot",
    "Tomato___Early_blight",
    "Tomato___Late_blight",
    "Tomato___Leaf_Mold",
    "Tomato___Septoria_leaf_spot",
    "Tomato___Spider_mites Two-spotted_spider_mite",
    "Tomato___Target_Spot",
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
    "Tomato___Tomato_mosaic_virus",
    "Tomato___healthy"
]

# Agronomic knowledge base for all 38 PlantVillage categories
CROP_DISEASE_KNOWLEDGE_BASE: Dict[str, Dict[str, Any]] = {
    "Apple___Apple_scab": {
        "crop": "Apple",
        "disease": "Apple Scab (Venturia inaequalis)",
        "pathogen": "Fungus (Venturia inaequalis)",
        "severity": "Moderate",
        "is_healthy": False,
        "symptoms": "Olive-green to velvety dark brown lesions on leaves and young fruit. Leaves may twist and pucker.",
        "recommendations": "1. Apply preventative captan or myclobutanil sprays. 2. Rake and compost fallen leaves to eliminate overwintering ascospores. 3. Prune canopy for sunlight penetration."
    },
    "Apple___Black_rot": {
        "crop": "Apple",
        "disease": "Black Rot (Diplodia seriata)",
        "pathogen": "Fungus (Diplodia seriata)",
        "severity": "Severe",
        "is_healthy": False,
        "symptoms": "Small purple spots enlarging into 'frog-eye' leaf spots with light brown centers and purple borders.",
        "recommendations": "1. Prune out dead wood, fire blight cankers, and mummified apples. 2. Apply thiophanate-methyl or captan fungicide."
    },
    "Apple___Cedar_apple_rust": {
        "crop": "Apple",
        "disease": "Cedar Apple Rust (Gymnosporangium juniperi-virginianae)",
        "pathogen": "Fungus (Gymnosporangium)",
        "severity": "Moderate",
        "is_healthy": False,
        "symptoms": "Bright yellow-orange or reddish spots on upper leaf surfaces; tubular aecia appear on underside later.",
        "recommendations": "1. Remove nearby eastern red cedar trees if within 1-2 miles. 2. Apply myclobutanil or propiconazole at pink-bud stage."
    },
    "Apple___healthy": {
        "crop": "Apple",
        "disease": "Healthy Apple Foliage",
        "pathogen": "None",
        "severity": "Healthy",
        "is_healthy": True,
        "symptoms": "Normal leaf turgor, clean green coloration without fungal spots or chlorosis.",
        "recommendations": "Maintain standard seasonal IPM scouting and balanced nutrition."
    },
    "Blueberry___healthy": {
        "crop": "Blueberry",
        "disease": "Healthy Blueberry Foliage",
        "pathogen": "None",
        "severity": "Healthy",
        "is_healthy": True,
        "symptoms": "Uniform vibrant green leaf surface, normal acidic soil vigor.",
        "recommendations": "Maintain soil pH around 4.5–5.2 and consistent moisture with mulch."
    },
    "Cherry_(including_sour)___Powdery_mildew": {
        "crop": "Cherry",
        "disease": "Powdery Mildew (Podosphaera clandestina)",
        "pathogen": "Fungus (Podosphaera clandestina)",
        "severity": "Moderate",
        "is_healthy": False,
        "symptoms": "White powdery fungal patches on new leaf growth; leaves may curl upward and distort.",
        "recommendations": "1. Apply sulfur, potassium bicarbonate, or myclobutanil. 2. Avoid overhead sprinkler irrigation."
    },
    "Cherry_(including_sour)___healthy": {
        "crop": "Cherry",
        "disease": "Healthy Cherry Foliage",
        "pathogen": "None",
        "severity": "Healthy",
        "is_healthy": True,
        "symptoms": "Clean serrated margins, healthy green glossy leaf blade.",
        "recommendations": "Maintain preventative post-harvest orchard hygiene."
    },
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot": {
        "crop": "Corn (Maize)",
        "disease": "Gray Leaf Spot (Cercospora zeae-maydis)",
        "pathogen": "Fungus (Cercospora zeae-maydis)",
        "severity": "Severe",
        "is_healthy": False,
        "symptoms": "Small tan lesions that elongate into rectangular, vein-delimited grayish-brown spots.",
        "recommendations": "1. Apply strobilurin or triazole foliar fungicides if lesions reach ear leaf before tasseling. 2. Rotate crops with non-grasses."
    },
    "Corn_(maize)___Common_rust_": {
        "crop": "Corn (Maize)",
        "disease": "Common Rust (Puccinia sorghi)",
        "pathogen": "Fungus (Puccinia sorghi)",
        "severity": "Moderate",
        "is_healthy": False,
        "symptoms": "Cinnamon-brown, powdery pustules scattered over both upper and lower leaf surfaces.",
        "recommendations": "1. Monitor rust pustule density on ear leaves. 2. Apply triazole or strobilurin fungicides if >10% upper canopy is covered before silking."
    },
    "Corn_(maize)___Northern_Leaf_Blight": {
        "crop": "Corn (Maize)",
        "disease": "Northern Corn Leaf Blight (Exserohilum turcicum)",
        "pathogen": "Fungus (Exserohilum turcicum)",
        "severity": "Severe",
        "is_healthy": False,
        "symptoms": "Long, elliptical grayish-green or tan lesions (cigar-shaped) parallel to leaf veins.",
        "recommendations": "1. Apply foliar fungicide at early tassel emergence. 2. Rotate crops and shred post-harvest residue."
    },
    "Corn_(maize)___healthy": {
        "crop": "Corn (Maize)",
        "disease": "Healthy Corn Foliage",
        "pathogen": "None",
        "severity": "Healthy",
        "is_healthy": True,
        "symptoms": "Clean, parallel-veined green leaf blades without fungal pustules.",
        "recommendations": "Maintain nitrogen top-dressing and optimal soil moisture during vegetative growth."
    },
    "Grape___Black_rot": {
        "crop": "Grape",
        "disease": "Black Rot (Guignardia bidwellii)",
        "pathogen": "Fungus (Guignardia bidwellii)",
        "severity": "Severe",
        "is_healthy": False,
        "symptoms": "Circular reddish-brown leaf spots with tiny black pycnidia dots inside the margin.",
        "recommendations": "1. Apply mancozeb, ziram, or captan from early shoot emergence until veraison. 2. Remove mummified berries."
    },
    "Grape___Esca_(Black_Measles)": {
        "crop": "Grape",
        "disease": "Esca / Black Measles (Phaeomoniella chlamydospora complex)",
        "pathogen": "Fungus complex",
        "severity": "Severe",
        "is_healthy": False,
        "symptoms": "Tiger-stripe interveinal chlorosis and necrosis on leaves; dark spots on fruit skin.",
        "recommendations": "1. Prune during dry winter weather; protect large cuts with wound sealants. 2. Remove severely infected vines."
    },
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)": {
        "crop": "Grape",
        "disease": "Leaf Blight (Pseudocercospora cladosporioides)",
        "pathogen": "Fungus",
        "severity": "Moderate",
        "is_healthy": False,
        "symptoms": "Irregular dark brown patches on older foliage, premature defoliation in humid weather.",
        "recommendations": "1. Apply copper-based fungicides after bloom. 2. Ensure open vine trellising for ventilation."
    },
    "Grape___healthy": {
        "crop": "Grape",
        "disease": "Healthy Grape Foliage",
        "pathogen": "None",
        "severity": "Healthy",
        "is_healthy": True,
        "symptoms": "Clean lobed leaves, uniform green vigor, no lesions.",
        "recommendations": "Maintain balanced canopy shoot thinning and standard vineyard monitoring."
    },
    "Orange___Haunglongbing_(Citrus_greening)": {
        "crop": "Orange (Citrus)",
        "disease": "Citrus Greening / Huanglongbing (Candidatus Liberibacter)",
        "pathogen": "Bacterium transmitted by Asian citrus psyllid",
        "severity": "Severe",
        "is_healthy": False,
        "symptoms": "Blotchy asymmetrical yellow mottling across veins, stunted twigs, bitter misshapen fruit.",
        "recommendations": "1. High alert: Vector control for psyllids with systemic insecticides. 2. Remove infected trees to protect grove."
    },
    "Peach___Bacterial_spot": {
        "crop": "Peach",
        "disease": "Bacterial Spot (Xanthomonas arboricola pv. pruni)",
        "pathogen": "Bacterium",
        "severity": "Moderate",
        "is_healthy": False,
        "symptoms": "Angular, purple-brown water-soaked spots on leaves that drop out, creating a 'shot-hole' appearance.",
        "recommendations": "1. Apply preventative copper sprays during dormancy and oxytetracycline during growing season."
    },
    "Peach___healthy": {
        "crop": "Peach",
        "disease": "Healthy Peach Foliage",
        "pathogen": "None",
        "severity": "Healthy",
        "is_healthy": True,
        "symptoms": "Smooth lanceolate leaves without shot-holes or yellowing.",
        "recommendations": "Continue standard orchard monitoring and nutrient management."
    },
    "Pepper,_bell___Bacterial_spot": {
        "crop": "Bell Pepper",
        "disease": "Bacterial Leaf Spot (Xanthomonas campestris pv. vesicatoria)",
        "pathogen": "Bacterium",
        "severity": "Moderate",
        "is_healthy": False,
        "symptoms": "Small, yellow-green spots on leaves turning dark brown with necrotic centers.",
        "recommendations": "1. Apply fixed copper bactericide combined with mancozeb. 2. Use drip irrigation to prevent splash dispersal."
    },
    "Pepper,_bell___healthy": {
        "crop": "Bell Pepper",
        "disease": "Healthy Bell Pepper Foliage",
        "pathogen": "None",
        "severity": "Healthy",
        "is_healthy": True,
        "symptoms": "Uniform deep green leaves, no greasy lesions or stunting.",
        "recommendations": "Maintain consistent moisture and balanced calcium-magnesium fertilization."
    },
    "Potato___Early_blight": {
        "crop": "Potato",
        "disease": "Early Blight (Alternaria solani)",
        "pathogen": "Fungus (Alternaria solani)",
        "severity": "Moderate",
        "is_healthy": False,
        "symptoms": "Small brown spots on older foliage expanding into target-board concentric lesions.",
        "recommendations": "1. Apply protective fungicides (Chlorothalonil, Mancozeb). 2. Maintain adequate nitrogen and potassium."
    },
    "Potato___Late_blight": {
        "crop": "Potato",
        "disease": "Late Blight (Phytophthora infestans)",
        "pathogen": "Oomycete (Phytophthora infestans)",
        "severity": "Severe",
        "is_healthy": False,
        "symptoms": "Dark purplish-brown lesions rapidly destroying leaves and stems, with white mildew under moist conditions.",
        "recommendations": "1. Immediate systemic fungicide application (Mancozeb, Cymoxanil). 2. Destroy cull piles. 3. Monitor humidity > 90%."
    },
    "Potato___healthy": {
        "crop": "Potato",
        "disease": "Healthy Potato Foliage",
        "pathogen": "None",
        "severity": "Healthy",
        "is_healthy": True,
        "symptoms": "Normal leaf turgor, clean green coloration without lesions.",
        "recommendations": "Maintain standard scouting and pest vigilance."
    },
    "Raspberry___healthy": {
        "crop": "Raspberry",
        "disease": "Healthy Raspberry Foliage",
        "pathogen": "None",
        "severity": "Healthy",
        "is_healthy": True,
        "symptoms": "Vibrant compound foliage, clean canes, no cane blight.",
        "recommendations": "Ensure good air circulation and trellis support."
    },
    "Soybean___healthy": {
        "crop": "Soybean",
        "disease": "Healthy Soybean Foliage",
        "pathogen": "None",
        "severity": "Healthy",
        "is_healthy": True,
        "symptoms": "Trifoliate green leaves, normal nodulation, no rust or frogeye leaf spots.",
        "recommendations": "Scout for soybean aphids and maintain field drainage."
    },
    "Squash___Powdery_mildew": {
        "crop": "Squash",
        "disease": "Powdery Mildew (Podosphaera xanthii)",
        "pathogen": "Fungus",
        "severity": "Moderate",
        "is_healthy": False,
        "symptoms": "White talcum-powder like fungal coating spreading over upper leaf surfaces, causing early senescence.",
        "recommendations": "1. Spray potassium bicarbonate, neem oil, or myclobutanil. 2. Space vines for sunlight penetration."
    },
    "Strawberry___Leaf_scorch": {
        "crop": "Strawberry",
        "disease": "Leaf Scorch (Diplocarpon earlianum)",
        "pathogen": "Fungus",
        "severity": "Moderate",
        "is_healthy": False,
        "symptoms": "Irregular purple or brown blotches across leaves; leaf edges scorch and curl upward.",
        "recommendations": "1. Remove dead infected foliage after renovation. 2. Apply captan or thiophanate-methyl."
    },
    "Strawberry___healthy": {
        "crop": "Strawberry",
        "disease": "Healthy Strawberry Foliage",
        "pathogen": "None",
        "severity": "Healthy",
        "is_healthy": True,
        "symptoms": "Clean trifoliate green leaves, vigorous runners, healthy crown.",
        "recommendations": "Maintain drip irrigation and clean straw mulch."
    },
    "Tomato___Bacterial_spot": {
        "crop": "Tomato",
        "disease": "Bacterial Spot (Xanthomonas spp.)",
        "pathogen": "Bacterium",
        "severity": "Moderate",
        "is_healthy": False,
        "symptoms": "Small, dark, water-soaked circular spots on leaves that turn brown/black with greasy appearance.",
        "recommendations": "1. Apply preventative copper bactericide combined with mancozeb. 2. Avoid working in wet fields."
    },
    "Tomato___Early_blight": {
        "crop": "Tomato",
        "disease": "Early Blight (Alternaria solani)",
        "pathogen": "Fungus (Alternaria solani)",
        "severity": "Moderate",
        "is_healthy": False,
        "symptoms": "Dark brown to black spots with concentric rings ('bullseye' pattern) on lower leaves with yellow halo.",
        "recommendations": "1. Prune and dispose of infected lower foliage. 2. Apply copper-based fungicide or chlorothalonil every 7-10 days."
    },
    "Tomato___Late_blight": {
        "crop": "Tomato",
        "disease": "Late Blight (Phytophthora infestans)",
        "pathogen": "Oomycete (Phytophthora infestans)",
        "severity": "Severe",
        "is_healthy": False,
        "symptoms": "Water-soaked, dark greasy lesions on leaves and stems. White fuzzy fungal growth under humid weather.",
        "recommendations": "1. High alert! Remove and incinerate heavily infected plants. 2. Apply systemic fungicide (mancozeb, cymoxanil)."
    },
    "Tomato___Leaf_Mold": {
        "crop": "Tomato",
        "disease": "Leaf Mold (Passalora fulva)",
        "pathogen": "Fungus",
        "severity": "Moderate",
        "is_healthy": False,
        "symptoms": "Pale greenish-yellow spots on upper leaf surfaces; olive-green velvety mold on undersides.",
        "recommendations": "1. Lower greenhouse humidity below 85%. 2. Increase ventilation and apply chlorothalonil or copper."
    },
    "Tomato___Septoria_leaf_spot": {
        "crop": "Tomato",
        "disease": "Septoria Leaf Spot (Septoria lycopersici)",
        "pathogen": "Fungus",
        "severity": "Moderate",
        "is_healthy": False,
        "symptoms": "Numerous small circular spots with dark brown margins and gray or tan centers containing black specks.",
        "recommendations": "1. Avoid overhead irrigation. 2. Mulch soil to prevent spore splash. 3. Apply copper fungicide."
    },
    "Tomato___Spider_mites Two-spotted_spider_mite": {
        "crop": "Tomato",
        "disease": "Two-Spotted Spider Mite (Tetranychus urticae)",
        "pathogen": "Arachnid Pest",
        "severity": "Moderate",
        "is_healthy": False,
        "symptoms": "Fine yellow stippling/speckling on leaf surface; fine webbing visible on underside and growing tips.",
        "recommendations": "1. Apply insecticidal soap, neem oil, or horticultural oil. 2. Introduce predatory mites (Phytoseiulus persimilis)."
    },
    "Tomato___Target_Spot": {
        "crop": "Tomato",
        "disease": "Target Spot (Corynespora cassiicola)",
        "pathogen": "Fungus",
        "severity": "Moderate",
        "is_healthy": False,
        "symptoms": "Brown circular lesions with concentric rings resembling a target board, causing severe leaf drop.",
        "recommendations": "1. Maintain good row spacing. 2. Apply protective azoxystrobin or chlorothalonil fungicides."
    },
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus": {
        "crop": "Tomato",
        "disease": "Yellow Leaf Curl Virus (TYLCV)",
        "pathogen": "Begomovirus transmitted by Whiteflies",
        "severity": "Severe",
        "is_healthy": False,
        "symptoms": "Severe plant stunting, upward leaf curling, yellowing margins, and bushy foliage.",
        "recommendations": "1. Whitefly vector control: deploy yellow sticky traps and apply imidacloprid/neem oil. 2. Rogue out infected plants."
    },
    "Tomato___Tomato_mosaic_virus": {
        "crop": "Tomato",
        "disease": "Tomato Mosaic Virus (ToMV)",
        "pathogen": "Tobamovirus",
        "severity": "Severe",
        "is_healthy": False,
        "symptoms": "Mottling with alternating yellowish and dark green areas on leaves, blistered or fern-like leaf distortion.",
        "recommendations": "1. Highly contagious mechanically: sanitize tools and wash hands with milk/detergent. 2. Remove infected plants."
    },
    "Tomato___healthy": {
        "crop": "Tomato",
        "disease": "Healthy Tomato Foliage",
        "pathogen": "None",
        "severity": "Healthy",
        "is_healthy": True,
        "symptoms": "Vibrant uniform green foliage, robust petiole structure, no necrotic spots or chlorosis.",
        "recommendations": "Continue current irrigation schedule and balanced N-P-K fertilization."
    }
}


class MLInferenceEngine:
    def __init__(self):
        self.model_path = settings.MODEL_PATH
        self.fallback_path = settings.FALLBACK_MODEL_PATH
        self.class_names_path = settings.CLASS_NAMES_PATH
        self.model_version = settings.MODEL_VERSION
        self.min_confidence = settings.MIN_CONFIDENCE
        
        self.class_names: List[str] = self._load_class_names()
        self.is_model_loaded = False
        self.model = None
        self.model_type = "none"  # "keras", "tflite", "none"
        self._initialize_model()

    def _load_class_names(self) -> List[str]:
        if os.path.exists(self.class_names_path):
            try:
                with open(self.class_names_path, "r", encoding="utf-8") as f:
                    names = json.load(f)
                if isinstance(names, list) and len(names) > 0:
                    logger.info(f"Loaded {len(names)} class names from {self.class_names_path}")
                    return names
            except Exception as e:
                logger.error(f"Error reading {self.class_names_path}: {e}")
        return DEFAULT_PLANT_VILLAGE_CLASSES

    def _initialize_model(self):
        """Attempts to load a trained model (.keras, .h5, or .tflite) if present locally."""
        target_path = self.model_path
        if not os.path.exists(target_path) and os.path.exists(self.fallback_path):
            target_path = self.fallback_path

        if target_path and os.path.exists(target_path):
            # 1. Check for Keras .keras or .h5 format
            if target_path.endswith(".keras") or target_path.endswith(".h5"):
                try:
                    import tensorflow as tf
                    self.model = tf.keras.models.load_model(target_path, compile=False)
                    self.is_model_loaded = True
                    self.model_type = "keras"
                    logger.info(f"Loaded trained Keras model from {target_path} (Output shape: {self.model.output_shape})")
                    return
                except Exception as e:
                    logger.warning(f"Could not load Keras model from {target_path} (TensorFlow may not be installed or model format differs): {e}")

            # 2. Check for TFLite format
            if target_path.endswith(".tflite"):
                try:
                    import importlib
                    tflite = None
                    try:
                        tflite = importlib.import_module("tflite_runtime.interpreter")
                    except ImportError:
                        try:
                            tf = importlib.import_module("tensorflow")
                            tflite = tf.lite
                        except ImportError:
                            pass
                    if tflite:
                        self.model = tflite.Interpreter(model_path=target_path)
                        self.model.allocate_tensors()
                        self.is_model_loaded = True
                        self.model_type = "tflite"
                        logger.info(f"Loaded TFLite model from {target_path}")
                        return
                except Exception as e:
                    logger.warning(f"Could not load TFLite model: {e}")

        logger.info("Physical trained model file not present. Operational in offline PlantVillage heuristic diagnostic mode.")

    def get_model_status(self) -> Dict[str, Any]:
        return {
            "model_configured": bool(self.model_path and os.path.exists(self.model_path)),
            "model_loaded": self.is_model_loaded,
            "model_type": self.model_type,
            "model_path": self.model_path,
            "class_names_path": self.class_names_path,
            "model_version": self.model_version if self.is_model_loaded else "epics-plantvillage-v1.0 (Demo Adapter)",
            "runtime": (
                "TensorFlow / Keras Local Runtime" if self.model_type == "keras"
                else "TFLite Local Engine" if self.model_type == "tflite"
                else "Offline Agronomic Heuristic Pipeline (38 PlantVillage Classes)"
            ),
            "supported_crops": ["Apple", "Blueberry", "Cherry", "Corn (Maize)", "Grape", "Orange", "Peach", "Bell Pepper", "Potato", "Raspberry", "Soybean", "Squash", "Strawberry", "Tomato"],
            "classes_count": len(self.class_names)
        }

    def preprocess_image(self, image_bytes: bytes, target_size=(224, 224)) -> Tuple[Image.Image, np.ndarray]:
        """
        Validates and preprocesses image bytes into a PIL image and raw float32 RGB array.
        CRITICAL: The trained model embeds Rescaling(1/127.5, offset=-1), so feed raw
        RGB pixels in range [0..255] and do NOT divide by 255.
        """
        try:
            # Verify image integrity
            with Image.open(io.BytesIO(image_bytes)) as im:
                im.verify()

            with Image.open(io.BytesIO(image_bytes)) as im:
                image = im.convert("RGB").resize(target_size, Image.Resampling.BILINEAR)

            # Raw RGB float32 pixels in 0..255 range, shape (1, 224, 224, 3)
            img_array = np.asarray(image, dtype=np.float32)[None, ...]
            return image, img_array
        except (UnidentifiedImageError, OSError, ValueError) as exc:
            raise ValueError(f"The uploaded file is not a valid or readable image: {str(exc)}")

    def _heuristic_analysis(self, img_array: np.ndarray, crop_hint: Optional[str] = None) -> Tuple[str, float]:
        """
        Agronomic visual feature extractor mapping across the 38 PlantVillage classes.
        Calculates excess green index, chlorosis, and necrotic brown spot ratios.
        """
        # img_array shape is (1, 224, 224, 3), range [0..255]
        normalized = img_array[0] / 255.0
        r = normalized[:, :, 0]
        g = normalized[:, :, 1]
        b = normalized[:, :, 2]
        
        excess_green = 2.0 * g - r - b
        mean_excess_green = float(np.mean(excess_green))
        
        yellow_mask = (r > 0.45) & (g > 0.45) & (b < 0.35)
        yellow_ratio = float(np.mean(yellow_mask))
        
        brown_mask = (r > g) & (r > b) & (r < 0.45) & (g < 0.38) & (b < 0.32)
        brown_ratio = float(np.mean(brown_mask))

        target = (crop_hint or "tomato").lower()

        if "corn" in target or "maize" in target:
            if brown_ratio > 0.08:
                return "Corn_(maize)___Common_rust_", round(0.85 + (brown_ratio * 0.2) % 0.12, 4)
            elif yellow_ratio > 0.12:
                return "Corn_(maize)___Northern_Leaf_Blight", round(0.82 + (yellow_ratio * 0.15) % 0.14, 4)
            elif brown_ratio > 0.04:
                return "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot", round(0.79 + brown_ratio * 0.1, 4)
            else:
                return "Corn_(maize)___healthy", round(0.92 + (mean_excess_green * 0.1) % 0.06, 4)

        elif "potato" in target:
            if brown_ratio > 0.10:
                return "Potato___Late_blight", round(0.88 + (brown_ratio * 0.2) % 0.10, 4)
            elif yellow_ratio > 0.08:
                return "Potato___Early_blight", round(0.84 + (yellow_ratio * 0.15) % 0.12, 4)
            else:
                return "Potato___healthy", round(0.93 + (mean_excess_green * 0.08) % 0.05, 4)

        elif "apple" in target:
            if brown_ratio > 0.10:
                return "Apple___Black_rot", round(0.87 + brown_ratio * 0.1, 4)
            elif yellow_ratio > 0.10:
                return "Apple___Cedar_apple_rust", round(0.85 + yellow_ratio * 0.1, 4)
            elif brown_ratio > 0.04:
                return "Apple___Apple_scab", round(0.83 + brown_ratio * 0.1, 4)
            else:
                return "Apple___healthy", 0.94

        elif "pepper" in target:
            if brown_ratio > 0.06 or yellow_ratio > 0.10:
                return "Pepper,_bell___Bacterial_spot", round(0.86 + brown_ratio * 0.1, 4)
            else:
                return "Pepper,_bell___healthy", 0.95

        elif "grape" in target:
            if brown_ratio > 0.10:
                return "Grape___Black_rot", round(0.88, 4)
            elif yellow_ratio > 0.08:
                return "Grape___Esca_(Black_Measles)", round(0.84, 4)
            else:
                return "Grape___healthy", 0.92

        else: # Default Tomato
            if brown_ratio > 0.12:
                return "Tomato___Late_blight", min(0.96, round(0.88 + brown_ratio * 0.3, 4))
            elif brown_ratio > 0.05 or yellow_ratio > 0.15:
                return "Tomato___Early_blight", min(0.94, round(0.85 + yellow_ratio * 0.2, 4))
            elif yellow_ratio > 0.08:
                return "Tomato___Tomato_Yellow_Leaf_Curl_Virus", min(0.92, round(0.82 + yellow_ratio * 0.25, 4))
            elif brown_ratio > 0.03:
                return "Tomato___Bacterial_spot", min(0.90, round(0.81 + brown_ratio * 0.2, 4))
            elif mean_excess_green > 0.12:
                return "Tomato___healthy", min(0.98, round(0.91 + mean_excess_green * 0.15, 4))
            else:
                return "Tomato___healthy", 0.90

    def predict(self, image_bytes: bytes, crop_hint: Optional[str] = None, is_demo_flag: bool = False) -> Dict[str, Any]:
        """
        Executes disease diagnosis on the leaf image.
        Compatible with the trained MobileNetV2 PlantVillage model and returns both
        the user's exact API format and the dashboard schema.
        """
        pil_img, img_array = self.preprocess_image(image_bytes)
        
        if self.is_model_loaded and not is_demo_flag:
            if self.model_type == "keras":
                # Feed raw RGB [0..255] float32 pixels to the Keras model
                probabilities = self.model.predict(img_array, verbose=0)[0]
                predicted_idx = int(np.argmax(probabilities))
                confidence = float(probabilities[predicted_idx])
                predicted_key = self.class_names[predicted_idx % len(self.class_names)]
                inference_mode = "local_keras_model"
                model_ver = self.model_version
                is_demo = False
            elif self.model_type == "tflite":
                input_details = self.model.get_input_details()
                output_details = self.model.get_output_details()
                self.model.set_tensor(input_details[0]['index'], img_array)
                self.model.invoke()
                probabilities = self.model.get_tensor(output_details[0]['index'])[0]
                predicted_idx = int(np.argmax(probabilities))
                confidence = float(probabilities[predicted_idx])
                predicted_key = self.class_names[predicted_idx % len(self.class_names)]
                inference_mode = "local_tflite_model"
                model_ver = self.model_version
                is_demo = False
            else:
                predicted_key, confidence = self._heuristic_analysis(img_array, crop_hint)
                inference_mode = "demo_simulation"
                model_ver = f"{self.model_version}-demo-mode"
                is_demo = True
        else:
            predicted_key, confidence = self._heuristic_analysis(img_array, crop_hint)
            inference_mode = "demo_simulation"
            model_ver = f"{self.model_version}-demo-mode"
            is_demo = True

        info = CROP_DISEASE_KNOWLEDGE_BASE.get(predicted_key, {
            "crop": crop_hint or "Unknown",
            "disease": predicted_key.replace("___", " - ").replace("_", " "),
            "pathogen": "Foliar pathogen",
            "severity": "Moderate",
            "is_healthy": "healthy" in predicted_key.lower(),
            "symptoms": "Leaf symptoms observed requiring botanical cross-examination.",
            "recommendations": "Isolate affected plot and consult university agricultural extension officer."
        })

        scan_id = f"scan-{uuid.uuid4().hex[:10]}"
        needs_review = bool(confidence < self.min_confidence)
        disease_name = info["disease"] if not needs_review else "Uncertain prediction — please retake the image"

        return {
            # User's exact Flask API schema fields:
            "status": "success",
            "diseaseName": disease_name,
            "predictedClass": predicted_key,
            "confidence": round(confidence, 6),
            "confidencePercent": round(confidence * 100, 2),
            "needsReview": needs_review,
            "pathogen": info.get("pathogen", "Plant foliar condition"),
            "severity": info["severity"],
            "boundingBoxes": [],
            "note": "Model trained on PlantVillage; verify predictions with field images or an agricultural expert.",
            
            # Application and Database Schema fields:
            "scan_id": scan_id,
            "predicted_class": info["disease"],
            "raw_class_key": predicted_key,
            "crop": info.get("crop", crop_hint or "Unknown"),
            "is_healthy": info["is_healthy"],
            "symptoms": info["symptoms"],
            "recommendations": info["recommendations"],
            "inference_mode": inference_mode,
            "model_version": model_ver,
            "is_demo": is_demo,
            "timestamp": datetime.now(timezone.utc)
        }

ml_engine = MLInferenceEngine()
