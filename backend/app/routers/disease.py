import os
import io
import base64
import uuid
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from PIL import Image

from app.database import get_db
from app.models.entities import DiseaseScan
from app.schemas.schemas import DiseasePredictionResponse, DiseaseScanHistoryItem
from app.services.ml_service import ml_engine
from app.services.alert_engine import process_disease_alert
from app.config import settings

router = APIRouter(prefix="/disease", tags=["AI Disease Detection"])

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

# Holds the latest live image transmitted by the ESP32 rover for instant browser verification
latest_rover_capture: Dict[str, Any] = {
    "has_image": False,
    "image_url": None,
    "scan_id": None,
    "prediction": None,
    "timestamp": None,
    "source": "standby"
}

async def extract_image_bytes(request: Request, file: Optional[UploadFile] = None, image: Optional[UploadFile] = None) -> Tuple[bytes, str]:
    """
    Extracts raw image bytes from either multipart upload (field 'file' or 'image')
    or JSON body with base64 encoded string ('image').
    """
    raw_bytes: Optional[bytes] = None
    filename: str = "upload.jpg"

    # 1. Check if multipart file was provided
    active_file = file or image
    if active_file:
        contents = await active_file.read()
        if len(contents) > 0:
            raw_bytes = contents
            filename = active_file.filename or "upload.jpg"

    # 2. Check if request is JSON base64
    if raw_bytes is None:
        try:
            body = await request.json()
            if isinstance(body, dict) and "image" in body:
                encoded = body["image"]
                if isinstance(encoded, str) and encoded:
                    if encoded.startswith("data:") and "," in encoded:
                        header, encoded = encoded.split(",", 1)
                    raw_bytes = base64.b64decode(encoded)
                    filename = "base64_upload.jpg"
        except Exception:
            pass

    # 3. Check if raw body is direct image bytes (e.g. from ESP32 camera client stream)
    if raw_bytes is None:
        body_bytes = await request.body()
        if len(body_bytes) > 100 and (body_bytes.startswith(b"\xff\xd8") or body_bytes.startswith(b"\x89PNG")):
            raw_bytes = body_bytes
            filename = "stream_capture.jpg"

    if not raw_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Send image as multipart file ('file' or 'image') or JSON base64 in 'image'."
        )

    if len(raw_bytes) > settings.MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image exceeds limit of {settings.MAX_IMAGE_BYTES // (1024 * 1024)} MB."
        )

    return raw_bytes, filename

@router.post("/predict", response_model=DiseasePredictionResponse, status_code=status.HTTP_201_CREATED)
async def predict_crop_disease(
    request: Request,
    file: Optional[UploadFile] = File(None),
    image: Optional[UploadFile] = File(None),
    farm_id: Optional[str] = Form(None),
    plot_id: Optional[str] = Form(None),
    row_id: Optional[str] = Form(None),
    crop_hint: Optional[str] = Form(None),
    device_id: Optional[str] = Form("rover-001"),
    is_demo: Optional[bool] = Form(False),
    db: Session = Depends(get_db)
):
    contents, original_fname = await extract_image_bytes(request, file, image)

    # Run ML prediction using the 38-class MobileNetV2 / PlantVillage engine
    try:
        prediction = ml_engine.predict(contents, crop_hint=crop_hint, is_demo_flag=is_demo or False)
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(val_err))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Prediction failed: {str(exc)}"
        )

    # Save image to upload directory for dashboard viewing
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(original_fname)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        ext = ".jpg"
    filename = f"{prediction['scan_id']}{ext}"
    saved_path = os.path.join(settings.UPLOAD_DIR, filename)
    with open(saved_path, "wb") as f:
        f.write(contents)

    relative_image_url = f"/static/uploads/{filename}"

    # Persist in Database
    scan_record = DiseaseScan(
        id=prediction["scan_id"],
        device_id=device_id or "rover-001",
        farm_id=farm_id,
        plot_id=plot_id,
        row_id=row_id,
        image_url=relative_image_url,
        original_filename=original_fname,
        predicted_class=prediction["predicted_class"],
        confidence=prediction["confidence"],
        severity=prediction["severity"],
        symptoms=prediction["symptoms"],
        recommendations=prediction["recommendations"],
        is_healthy=prediction["is_healthy"],
        inference_mode=prediction["inference_mode"],
        model_version=prediction["model_version"],
        is_demo=prediction["is_demo"],
        timestamp=prediction["timestamp"]
    )
    db.add(scan_record)
    db.commit()
    db.refresh(scan_record)

    # Trigger alert if diseased
    process_disease_alert(db, scan_record)

    response_payload = {
        # EPICS MobileNetV2 Flask API compatible fields:
        "status": "success",
        "diseaseName": prediction["diseaseName"],
        "predictedClass": prediction["predictedClass"],
        "confidence": prediction["confidence"],
        "confidencePercent": prediction["confidencePercent"],
        "needsReview": prediction["needsReview"],
        "pathogen": prediction.get("pathogen", "Plant foliar condition"),
        "severity": prediction["severity"],
        "boundingBoxes": [],
        "note": prediction.get("note", "Model trained on PlantVillage; verify predictions with field images or an agricultural expert."),

        # Application & Database fields:
        "scan_id": scan_record.id,
        "predicted_class": scan_record.predicted_class,
        "is_healthy": scan_record.is_healthy,
        "symptoms": scan_record.symptoms or "",
        "recommendations": scan_record.recommendations or "",
        "model_version": scan_record.model_version,
        "inference_mode": scan_record.inference_mode,
        "is_demo": scan_record.is_demo,
        "image_url": scan_record.image_url,
        "farm_id": scan_record.farm_id,
        "plot_id": scan_record.plot_id,
        "row_id": scan_record.row_id,
        "timestamp": scan_record.timestamp
    }

    # Update in-memory latest rover capture for instant browser polling
    global latest_rover_capture
    latest_rover_capture = {
        "has_image": True,
        "image_url": relative_image_url,
        "scan_id": scan_record.id,
        "prediction": response_payload,
        "timestamp": scan_record.timestamp.isoformat(),
        "source": "esp32_rover" if "cam" in (device_id or "").lower() or "rover" in (device_id or "").lower() else "user_upload"
    }

    return response_payload

@router.post("/camera/upload", response_model=DiseasePredictionResponse)
async def upload_camera_frame(
    request: Request,
    file: Optional[UploadFile] = File(None),
    image: Optional[UploadFile] = File(None),
    plot_id: Optional[str] = Form(None),
    farm_id: Optional[str] = Form(None),
    row_id: Optional[str] = Form(None),
    device_id: Optional[str] = Form("rover-001"),
    db: Session = Depends(get_db)
):
    """Direct ingestion endpoint for ESP32-CAM captured leaf photographs."""
    return await predict_crop_disease(
        request=request,
        file=file,
        image=image,
        farm_id=farm_id,
        plot_id=plot_id,
        row_id=row_id,
        crop_hint=None,
        device_id=device_id,
        is_demo=False,
        db=db
    )

@router.get("/latest-capture")
def get_latest_rover_capture():
    """Returns the most recent leaf frame received from the rover for live browser display."""
    return latest_rover_capture

@router.get("/scans", response_model=List[DiseaseScanHistoryItem])
def list_disease_scans(
    plot_id: Optional[str] = Query(None),
    farm_id: Optional[str] = Query(None),
    is_healthy: Optional[bool] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    query = db.query(DiseaseScan)
    if plot_id:
        query = query.filter(DiseaseScan.plot_id == plot_id)
    if farm_id:
        query = query.filter(DiseaseScan.farm_id == farm_id)
    if is_healthy is not None:
        query = query.filter(DiseaseScan.is_healthy == is_healthy)
    return query.order_by(DiseaseScan.timestamp.desc()).limit(limit).all()

@router.get("/scans/{scan_id}", response_model=DiseasePredictionResponse)
def get_disease_scan_detail(scan_id: str, db: Session = Depends(get_db)):
    scan = db.query(DiseaseScan).filter(DiseaseScan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan record not found")
    
    # Return formatted payload
    return {
        "status": "success",
        "diseaseName": scan.predicted_class,
        "predictedClass": scan.predicted_class,
        "confidence": scan.confidence,
        "confidencePercent": round(scan.confidence * 100, 2),
        "needsReview": scan.confidence < settings.MIN_CONFIDENCE,
        "pathogen": "Identified by PlantVillage CNN Classifier",
        "severity": scan.severity,
        "scan_id": scan.id,
        "predicted_class": scan.predicted_class,
        "is_healthy": scan.is_healthy,
        "symptoms": scan.symptoms or "",
        "recommendations": scan.recommendations or "",
        "model_version": scan.model_version,
        "inference_mode": scan.inference_mode,
        "is_demo": scan.is_demo,
        "image_url": scan.image_url,
        "farm_id": scan.farm_id,
        "plot_id": scan.plot_id,
        "row_id": scan.row_id,
        "timestamp": scan.timestamp
    }

@router.get("/model-status")
def get_model_status():
    """Returns local offline ML model configuration, loaded state, and supported categories."""
    return ml_engine.get_model_status()
