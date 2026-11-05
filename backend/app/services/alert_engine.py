from datetime import datetime, timezone, timedelta
from typing import Optional, List
from sqlalchemy.orm import Session

from app.models.entities import Alert, Telemetry, DiseaseScan
from app.config import settings

COOL_OFF_MINUTES = 15

def is_recent_duplicate(db: Session, alert_type: str, plot_id: Optional[str]) -> bool:
    """Checks whether an active, unacknowledged alert of the same type for this plot was issued recently."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=COOL_OFF_MINUTES)
    query = db.query(Alert).filter(
        Alert.alert_type == alert_type,
        Alert.acknowledged == False,
        Alert.timestamp >= cutoff
    )
    if plot_id:
        query = query.filter(Alert.plot_id == plot_id)
        
    return db.query(query.exists()).scalar()

def process_telemetry_alerts(db: Session, telemetry: Telemetry) -> List[Alert]:
    """Evaluates telemetry readings and generates alerts if thresholds are breached."""
    created_alerts = []
    
    # 1. Soil Moisture Checks
    if telemetry.soil_moisture_percent is not None:
        if telemetry.soil_moisture_percent < settings.MOISTURE_MIN_PERCENT:
            if not is_recent_duplicate(db, "SOIL_MOISTURE_LOW", telemetry.plot_id):
                alert = Alert(
                    alert_type="SOIL_MOISTURE_LOW",
                    severity="CRITICAL" if telemetry.soil_moisture_percent < 20.0 else "WARNING",
                    farm_id=telemetry.farm_id,
                    plot_id=telemetry.plot_id,
                    title="Low Soil Moisture Detected",
                    message=f"Soil moisture at {telemetry.soil_moisture_percent:.1f}% is below minimum threshold ({settings.MOISTURE_MIN_PERCENT}%). Irrigation recommended.",
                    reading_value=telemetry.soil_moisture_percent,
                    threshold_value=settings.MOISTURE_MIN_PERCENT
                )
                db.add(alert)
                created_alerts.append(alert)
                
        elif telemetry.soil_moisture_percent > settings.MOISTURE_MAX_PERCENT:
            if not is_recent_duplicate(db, "SOIL_MOISTURE_HIGH", telemetry.plot_id):
                alert = Alert(
                    alert_type="SOIL_MOISTURE_HIGH",
                    severity="WARNING",
                    farm_id=telemetry.farm_id,
                    plot_id=telemetry.plot_id,
                    title="Excessive Soil Saturation",
                    message=f"Soil moisture at {telemetry.soil_moisture_percent:.1f}% exceeds threshold ({settings.MOISTURE_MAX_PERCENT}%). Inspect drainage to avoid root rot.",
                    reading_value=telemetry.soil_moisture_percent,
                    threshold_value=settings.MOISTURE_MAX_PERCENT
                )
                db.add(alert)
                created_alerts.append(alert)

    # 2. Soil pH Checks
    if telemetry.soil_ph is not None:
        if telemetry.soil_ph < settings.PH_MIN or telemetry.soil_ph > settings.PH_MAX:
            if not is_recent_duplicate(db, "SOIL_PH_OUT_OF_RANGE", telemetry.plot_id):
                alert = Alert(
                    alert_type="SOIL_PH_OUT_OF_RANGE",
                    severity="WARNING",
                    farm_id=telemetry.farm_id,
                    plot_id=telemetry.plot_id,
                    title="Sub-optimal Soil pH",
                    message=f"Soil pH reading of {telemetry.soil_ph:.2f} is outside the healthy agricultural range ({settings.PH_MIN} - {settings.PH_MAX}). Soil amendment needed.",
                    reading_value=telemetry.soil_ph,
                    threshold_value=settings.PH_MIN if telemetry.soil_ph < settings.PH_MIN else settings.PH_MAX
                )
                db.add(alert)
                created_alerts.append(alert)

    # 3. Ambient Temperature Checks
    if telemetry.temperature_c is not None:
        if telemetry.temperature_c > settings.TEMP_MAX_C:
            if not is_recent_duplicate(db, "HIGH_TEMPERATURE", telemetry.plot_id):
                alert = Alert(
                    alert_type="HIGH_TEMPERATURE",
                    severity="WARNING",
                    farm_id=telemetry.farm_id,
                    plot_id=telemetry.plot_id,
                    title="Extreme Ambient Heat Detected",
                    message=f"Temperature reached {telemetry.temperature_c:.1f}°C, exceeding heat stress threshold ({settings.TEMP_MAX_C}°C).",
                    reading_value=telemetry.temperature_c,
                    threshold_value=settings.TEMP_MAX_C
                )
                db.add(alert)
                created_alerts.append(alert)

    if created_alerts:
        db.commit()
        for a in created_alerts:
            db.refresh(a)

    return created_alerts

def process_disease_alert(db: Session, scan: DiseaseScan) -> Optional[Alert]:
    """Generates an alert if an active disease is identified with high confidence."""
    if not scan.is_healthy and scan.confidence >= settings.DISEASE_CONFIDENCE_ALERT:
        alert = Alert(
            alert_type="DISEASE_DETECTED",
            severity="CRITICAL" if scan.severity == "Severe" else "WARNING",
            farm_id=scan.farm_id,
            plot_id=scan.plot_id,
            title=f"Crop Disease: {scan.predicted_class}",
            message=f"Detected {scan.predicted_class} with {int(scan.confidence * 100)}% confidence at Plot {scan.plot_id or 'General'}. Immediate action required: {scan.recommendations[:140]}...",
            reading_value=scan.confidence,
            threshold_value=settings.DISEASE_CONFIDENCE_ALERT
        )
        db.add(alert)
        db.commit()
        db.refresh(alert)
        return alert
    return None
