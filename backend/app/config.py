import os
from pydantic_settings import BaseSettings
from typing import Optional

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class Settings(BaseSettings):
    APP_NAME: str = "Smart Agriculture Rover API"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api/v1"
    DATABASE_URL: str = "sqlite:///./agri_rover.db"
    
    # Storage & Uploads
    UPLOAD_DIR: str = os.path.join(BASE_DIR, "static", "uploads")
    
    # Machine Learning configuration
    # Primary model path: plant_disease_model.keras from train_epics_model.py
    MODEL_PATH: str = os.getenv(
        "MODEL_PATH",
        os.path.join(BASE_DIR, "models", "plant_disease_model.keras")
    )
    FALLBACK_MODEL_PATH: str = os.path.join(BASE_DIR, "models", "crop_disease_model.tflite")
    CLASS_NAMES_PATH: str = os.path.join(BASE_DIR, "models", "class_names.json")
    MODEL_VERSION: str = "v1.2.0-mobilenetv2-plantvillage"
    MIN_CONFIDENCE: float = 0.60
    MAX_IMAGE_BYTES: int = 8 * 1024 * 1024  # 8 MB
    
    # Rover configuration
    DEFAULT_DEVICE_ID: str = "rover-001"
    ROVER_OFFLINE_THRESHOLD_SECONDS: int = 45
    COMMAND_TIMEOUT_SECONDS: int = 15
    MAX_MOVEMENT_DURATION_MS: int = 5000  # safety limit per motion command
    
    # Sensor thresholds for alert triggers
    MOISTURE_MIN_PERCENT: float = 30.0
    MOISTURE_MAX_PERCENT: float = 80.0
    PH_MIN: float = 6.0
    PH_MAX: float = 7.5
    TEMP_MIN_C: float = 12.0
    TEMP_MAX_C: float = 38.0
    HUMIDITY_MIN_PERCENT: float = 30.0
    HUMIDITY_MAX_PERCENT: float = 85.0
    DISEASE_CONFIDENCE_ALERT: float = 0.70
    
    # Default mode
    DEMO_MODE_DEFAULT: bool = False
    
    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
