from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.entities import Alert
from app.schemas.schemas import AlertResponse, AlertAckRequest, AlertConfig
from app.config import settings

router = APIRouter(prefix="/alerts", tags=["Alerts & Notifications"])

@router.get("", response_model=List[AlertResponse])
def get_alerts(
    acknowledged: Optional[bool] = Query(None),
    severity: Optional[str] = Query(None),
    plot_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    query = db.query(Alert)
    if acknowledged is not None:
        query = query.filter(Alert.acknowledged == acknowledged)
    if severity:
        query = query.filter(Alert.severity == severity.upper())
    if plot_id:
        query = query.filter(Alert.plot_id == plot_id)
        
    return query.order_by(Alert.timestamp.desc()).limit(limit).all()

@router.post("/{alert_id}/ack", response_model=AlertResponse)
def acknowledge_alert(alert_id: int, payload: AlertAckRequest, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
        
    alert.acknowledged = payload.acknowledged
    alert.acknowledged_at = datetime.now(timezone.utc) if payload.acknowledged else None
    db.commit()
    db.refresh(alert)
    return alert

@router.get("/config", response_model=AlertConfig)
def get_alert_configuration():
    return AlertConfig(
        moisture_min=settings.MOISTURE_MIN_PERCENT,
        moisture_max=settings.MOISTURE_MAX_PERCENT,
        ph_min=settings.PH_MIN,
        ph_max=settings.PH_MAX,
        temp_min=settings.TEMP_MIN_C,
        temp_max=settings.TEMP_MAX_C,
        humidity_min=settings.HUMIDITY_MIN_PERCENT,
        humidity_max=settings.HUMIDITY_MAX_PERCENT,
        disease_confidence_threshold=settings.DISEASE_CONFIDENCE_ALERT
    )

@router.put("/config", response_model=AlertConfig)
def update_alert_configuration(config: AlertConfig):
    settings.MOISTURE_MIN_PERCENT = config.moisture_min
    settings.MOISTURE_MAX_PERCENT = config.moisture_max
    settings.PH_MIN = config.ph_min
    settings.PH_MAX = config.ph_max
    settings.TEMP_MIN_C = config.temp_min
    settings.TEMP_MAX_C = config.temp_max
    settings.HUMIDITY_MIN_PERCENT = config.humidity_min
    settings.HUMIDITY_MAX_PERCENT = config.humidity_max
    settings.DISEASE_CONFIDENCE_ALERT = config.disease_confidence_threshold
    return config
