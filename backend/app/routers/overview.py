from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.entities import Farm, Plot, Telemetry, DiseaseScan, Alert, RoverStatus
from app.schemas.schemas import OverviewSummary, RoverStatusResponse, TelemetryResponse, DiseaseScanHistoryItem, AlertResponse
from app.services.rover_manager import get_or_create_rover, check_rover_online_state
from app.services.ml_service import ml_engine
from app.config import settings

router = APIRouter(prefix="/overview", tags=["Overview"])

@router.get("", response_model=OverviewSummary)
def get_overview_summary(db: Session = Depends(get_db)):
    total_farms = db.query(Farm).count()
    total_plots = db.query(Plot).count()
    
    # Rover status
    rover = get_or_create_rover(db, settings.DEFAULT_DEVICE_ID)
    is_live = check_rover_online_state(rover)
    
    rover_resp = RoverStatusResponse(
        device_id=rover.device_id,
        name=rover.name,
        is_online=is_live,
        battery_percent=rover.battery_percent,
        signal_rssi=rover.signal_rssi,
        ip_address=rover.ip_address,
        mode=rover.mode,
        last_heartbeat=rover.last_heartbeat,
        last_command=rover.last_command,
        last_response=rover.last_response,
        is_stale=not is_live
    )
    
    # Latest telemetry
    latest_telemetry_obj = db.query(Telemetry).order_by(Telemetry.timestamp.desc()).first()
    latest_telemetry = TelemetryResponse.model_validate(latest_telemetry_obj) if latest_telemetry_obj else None
    
    # Scans summary
    total_scans = db.query(DiseaseScan).count()
    healthy_scans = db.query(DiseaseScan).filter(DiseaseScan.is_healthy == True).count()
    diseased_scans = total_scans - healthy_scans
    
    latest_scan_obj = db.query(DiseaseScan).order_by(DiseaseScan.timestamp.desc()).first()
    latest_scan = DiseaseScanHistoryItem.model_validate(latest_scan_obj) if latest_scan_obj else None
    
    # Alerts
    active_alerts_count = db.query(Alert).filter(Alert.acknowledged == False).count()
    recent_alerts_objs = db.query(Alert).order_by(Alert.timestamp.desc()).limit(5).all()
    recent_alerts = [AlertResponse.model_validate(a) for a in recent_alerts_objs]
    
    return OverviewSummary(
        total_farms=total_farms,
        total_plots=total_plots,
        rover_status=rover_resp,
        latest_telemetry=latest_telemetry,
        latest_scan=latest_scan,
        total_scans=total_scans,
        healthy_scans=healthy_scans,
        diseased_scans=diseased_scans,
        active_alerts_count=active_alerts_count,
        recent_alerts=recent_alerts,
        is_demo_mode=settings.DEMO_MODE_DEFAULT,
        model_status=ml_engine.get_model_status()
    )
