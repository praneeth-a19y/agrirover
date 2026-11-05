import os
import sys
# Ensure backend directory is in python path regardless of how main.py is executed
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import logging
from typing import Optional
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, File, UploadFile, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import engine, Base, SessionLocal, get_db
from sqlalchemy.orm import Session
from app.models.entities import Farm
from app.routers import (
    overview,
    telemetry,
    disease,
    rover,
    farms,
    alerts,
    analytics,
    calibration,
    demo
)
from app.routers.demo import seed_demo_data

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("agri_rover")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create DB tables & ensure upload directory exists
    logger.info("Initializing database schema...")
    Base.metadata.create_all(bind=engine)
    
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    logger.info(f"Upload directory verified at {settings.UPLOAD_DIR}")
    
    # Auto-seed initial demo dataset if database has zero farms
    db = SessionLocal()
    try:
        farm_count = db.query(Farm).count()
        if farm_count == 0:
            logger.info("Database is clean. Automatically seeding initial demo dataset...")
            seed_demo_data(db)
            logger.info("Demo data seeding completed.")
    finally:
        db.close()
        
    yield
    logger.info("Shutting down Smart Agriculture Rover backend...")

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="IoT Telemetry Ingestion, AI Leaf Disease Classification, and Rover Command Gateway for EPICS Project",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file serving for leaf photographs and scans
static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Include Modular Routers
app.include_router(overview.router, prefix=settings.API_PREFIX)
app.include_router(telemetry.router, prefix=settings.API_PREFIX)
app.include_router(disease.router, prefix=settings.API_PREFIX)
app.include_router(rover.router, prefix=settings.API_PREFIX)
app.include_router(farms.router, prefix=settings.API_PREFIX)
app.include_router(alerts.router, prefix=settings.API_PREFIX)
app.include_router(analytics.router, prefix=settings.API_PREFIX)
app.include_router(calibration.router, prefix=settings.API_PREFIX)
app.include_router(demo.router, prefix=settings.API_PREFIX)

# Direct Compatibility Endpoints for ESP32 and User ML API
@app.get("/health")
def health():
    from app.services.ml_service import ml_engine
    return {
        "status": "ready",
        "modelLoaded": ml_engine.is_model_loaded,
        "numClasses": len(ml_engine.class_names)
    }

@app.post("/predict")
@app.post("/upload")
async def root_predict(
    request: Request,
    file: Optional[UploadFile] = File(None),
    image: Optional[UploadFile] = File(None),
    plot_id: Optional[str] = Form(None),
    farm_id: Optional[str] = Form(None),
    device_id: Optional[str] = Form("rover-001"),
    db: Session = Depends(get_db)
):
    """Direct root endpoint compatibility for ESP32-CAM and client image uploads."""
    return await disease.predict_crop_disease(
        request=request,
        file=file,
        image=image,
        farm_id=farm_id,
        plot_id=plot_id,
        row_id=None,
        crop_hint=None,
        device_id=device_id,
        is_demo=False,
        db=db
    )

@app.get("/")
def root():
    return {
        "project": "Smart Agriculture Rover — AI-Powered Crop & Soil Monitoring System",
        "epics_evaluation": "College Engineering Project Demonstration",
        "version": settings.VERSION,
        "docs_url": "/docs",
        "redoc_url": "/redoc",
        "status": "Operational",
        "endpoints": {
            "overview": f"{settings.API_PREFIX}/overview",
            "telemetry": f"{settings.API_PREFIX}/telemetry",
            "disease_predict": f"{settings.API_PREFIX}/disease/predict",
            "rover_control": f"{settings.API_PREFIX}/rover/commands",
            "farms": f"{settings.API_PREFIX}/farms",
            "alerts": f"{settings.API_PREFIX}/alerts",
            "analytics": f"{settings.API_PREFIX}/analytics/timeseries",
            "calibration": f"{settings.API_PREFIX}/calibration"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
