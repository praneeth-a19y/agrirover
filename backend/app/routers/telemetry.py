from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.entities import Telemetry, RoverStatus
from app.schemas.schemas import TelemetryCreate, TelemetryResponse
from app.services.alert_engine import process_telemetry_alerts
from app.services.calibration_service import convert_raw_moisture_adc, convert_raw_ph_voltage
from app.services.rover_manager import update_rover_heartbeat

router = APIRouter(prefix="/telemetry", tags=["Telemetry"])

@router.post("", response_model=TelemetryResponse, status_code=status.HTTP_201_CREATED)
def ingest_telemetry(payload: TelemetryCreate, db: Session = Depends(get_db)):
    # Calibration conversion if raw signals are provided and calibrated values are omitted
    calibrated_moisture = payload.soil_moisture_percent
    if calibrated_moisture is None and payload.raw_moisture_adc is not None:
        calibrated_moisture = convert_raw_moisture_adc(db, payload.raw_moisture_adc)
        
    calibrated_ph = payload.soil_ph
    if calibrated_ph is None and payload.raw_ph_voltage is not None:
        calibrated_ph = convert_raw_ph_voltage(db, payload.raw_ph_voltage)
        
    record_time = payload.timestamp or datetime.now(timezone.utc)
    if record_time.tzinfo is None:
        record_time = record_time.replace(tzinfo=timezone.utc)

    telemetry = Telemetry(
        device_id=payload.device_id,
        farm_id=payload.farm_id,
        plot_id=payload.plot_id,
        temperature_c=payload.temperature_c,
        humidity_percent=payload.humidity_percent,
        soil_moisture_percent=calibrated_moisture,
        soil_ph=calibrated_ph,
        raw_moisture_adc=payload.raw_moisture_adc,
        raw_ph_voltage=payload.raw_ph_voltage,
        is_simulated=payload.is_simulated or False,
        timestamp=record_time
    )
    db.add(telemetry)
    db.commit()
    db.refresh(telemetry)
    
    # Update rover heartbeat so rover status reflects live connection
    update_rover_heartbeat(db, device_id=payload.device_id)
    
    # Check alert rules
    process_telemetry_alerts(db, telemetry)
    
    return telemetry

@router.get("/latest", response_model=Optional[TelemetryResponse])
def get_latest_telemetry(
    plot_id: Optional[str] = Query(None, description="Optional filter by plot identifier"),
    db: Session = Depends(get_db)
):
    query = db.query(Telemetry)
    if plot_id:
        query = query.filter(Telemetry.plot_id == plot_id)
    record = query.order_by(Telemetry.timestamp.desc()).first()
    return record

@router.get("/history", response_model=List[TelemetryResponse])
def get_telemetry_history(
    plot_id: Optional[str] = Query(None),
    farm_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db)
):
    query = db.query(Telemetry)
    if plot_id:
        query = query.filter(Telemetry.plot_id == plot_id)
    if farm_id:
        query = query.filter(Telemetry.farm_id == farm_id)
    return query.order_by(Telemetry.timestamp.desc()).limit(limit).all()
