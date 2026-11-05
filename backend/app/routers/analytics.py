import csv
import io
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, Response, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.entities import Telemetry, DiseaseScan, Plot

router = APIRouter(prefix="/analytics", tags=["Sensor Analytics"])

@router.get("/timeseries")
def get_sensor_timeseries(
    plot_id: Optional[str] = Query(None),
    range_filter: str = Query("24h", description="Time range: 24h, 7d, 30d, all"),
    db: Session = Depends(get_db)
):
    query = db.query(Telemetry)
    
    if plot_id:
        query = query.filter(Telemetry.plot_id == plot_id)
        
    now = datetime.now(timezone.utc)
    if range_filter == "24h":
        cutoff = now - timedelta(hours=24)
        query = query.filter(Telemetry.timestamp >= cutoff)
    elif range_filter == "7d":
        cutoff = now - timedelta(days=7)
        query = query.filter(Telemetry.timestamp >= cutoff)
    elif range_filter == "30d":
        cutoff = now - timedelta(days=30)
        query = query.filter(Telemetry.timestamp >= cutoff)

    # Sort chronological for charts
    records = query.order_by(Telemetry.timestamp.asc()).all()
    
    data = []
    for r in records:
        ts_str = r.timestamp.strftime("%Y-%m-%d %H:%M") if r.timestamp else ""
        data.append({
            "timestamp": ts_str,
            "iso_time": r.timestamp.isoformat() if r.timestamp else "",
            "plot_id": r.plot_id or "General",
            "temperature_c": r.temperature_c,
            "humidity_percent": r.humidity_percent,
            "soil_moisture_percent": r.soil_moisture_percent,
            "soil_ph": r.soil_ph,
            "is_simulated": r.is_simulated
        })
    return data

@router.get("/disease-distribution")
def get_disease_distribution(
    plot_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(DiseaseScan)
    if plot_id:
        query = query.filter(DiseaseScan.plot_id == plot_id)
        
    total = query.count()
    healthy = query.filter(DiseaseScan.is_healthy == True).count()
    diseased = total - healthy
    
    # Group by predicted class
    classes_counts = db.query(
        DiseaseScan.predicted_class,
        func.count(DiseaseScan.id)
    )
    if plot_id:
        classes_counts = classes_counts.filter(DiseaseScan.plot_id == plot_id)
    classes_counts = classes_counts.group_by(DiseaseScan.predicted_class).all()
    
    breakdown = [{"name": c[0], "count": c[1]} for c in classes_counts]

    return {
        "total_scans": total,
        "healthy_count": healthy,
        "diseased_count": diseased,
        "health_rate_percent": round((healthy / total * 100), 1) if total > 0 else 100.0,
        "breakdown": breakdown
    }

@router.get("/export/csv")
def export_csv(
    data_type: str = Query("telemetry", pattern="^(telemetry|scans)$"),
    plot_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    output = io.StringIO()
    writer = csv.writer(output)
    
    if data_type == "telemetry":
        filename = f"telemetry_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        writer.writerow([
            "ID", "Device ID", "Farm ID", "Plot ID",
            "Temperature (C)", "Humidity (% RH)", "Soil Moisture (%)",
            "Soil pH", "Raw Moisture ADC", "Raw pH Voltage", "Simulated", "Timestamp"
        ])
        query = db.query(Telemetry)
        if plot_id:
            query = query.filter(Telemetry.plot_id == plot_id)
        for r in query.order_by(Telemetry.timestamp.desc()).all():
            writer.writerow([
                r.id, r.device_id, r.farm_id or "", r.plot_id or "",
                r.temperature_c if r.temperature_c is not None else "",
                r.humidity_percent if r.humidity_percent is not None else "",
                r.soil_moisture_percent if r.soil_moisture_percent is not None else "",
                r.soil_ph if r.soil_ph is not None else "",
                r.raw_moisture_adc if r.raw_moisture_adc is not None else "",
                r.raw_ph_voltage if r.raw_ph_voltage is not None else "",
                "Yes" if r.is_simulated else "No",
                r.timestamp.isoformat() if r.timestamp else ""
            ])
            
    else:  # scans
        filename = f"crop_disease_scans_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        writer.writerow([
            "Scan ID", "Device ID", "Farm ID", "Plot ID", "Row ID",
            "Predicted Disease / Diagnosis", "Confidence", "Severity",
            "Healthy", "Inference Mode", "Model Version", "Is Demo", "Timestamp"
        ])
        query = db.query(DiseaseScan)
        if plot_id:
            query = query.filter(DiseaseScan.plot_id == plot_id)
        for s in query.order_by(DiseaseScan.timestamp.desc()).all():
            writer.writerow([
                s.id, s.device_id, s.farm_id or "", s.plot_id or "", s.row_id or "",
                s.predicted_class, s.confidence, s.severity,
                "Yes" if s.is_healthy else "No",
                s.inference_mode, s.model_version,
                "Yes" if s.is_demo else "No",
                s.timestamp.isoformat() if s.timestamp else ""
            ])

    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
