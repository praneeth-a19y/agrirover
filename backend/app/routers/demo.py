import math
import random
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.entities import (
    Farm,
    Plot,
    Telemetry,
    DiseaseScan,
    Alert,
    RoverStatus,
    RoverCommand,
    SensorCalibration
)
from app.services.alert_engine import process_telemetry_alerts
from app.config import settings

router = APIRouter(prefix="/demo", tags=["Demo Mode & Simulation"])

@router.post("/seed", status_code=status.HTTP_200_OK)
def seed_demo_data(db: Session = Depends(get_db)):
    """Populates realistic agritech demo data for EPICS evaluation."""
    
    # 1. Register Demo Farm
    farm = db.query(Farm).filter(Farm.id == "farm-001").first()
    if not farm:
        farm = Farm(
            id="farm-001",
            name="GreenValley Agritech Campus",
            location="University Agricultural Research Station, Plot B",
            area_acres=4.5,
            notes="Demo testing site equipped with IoT telemetry testbed and Autonomous Rover Track."
        )
        db.add(farm)
        db.commit()

    # 2. Register Demo Plots
    plots_data = [
        {"id": "plot-001", "name": "North Tomato Field", "crop": "Tomato", "r": 0, "c": 0, "dim": "30m x 20m", "rows": "Rows A1-A8"},
        {"id": "plot-002", "name": "East Potato Block", "crop": "Potato", "r": 0, "c": 1, "dim": "25m x 15m", "rows": "Rows B1-B6"},
        {"id": "plot-003", "name": "Central Corn Patch", "crop": "Corn (Maize)", "r": 1, "c": 0, "dim": "40m x 25m", "rows": "Rows C1-C10"},
        {"id": "plot-004", "name": "South Bell Pepper Bed", "crop": "Bell Pepper", "r": 1, "c": 1, "dim": "20m x 15m", "rows": "Rows D1-D4"},
    ]
    
    for p in plots_data:
        existing_plot = db.query(Plot).filter(Plot.id == p["id"]).first()
        if not existing_plot:
            new_plot = Plot(
                id=p["id"],
                farm_id="farm-001",
                name=p["name"],
                crop_type=p["crop"],
                grid_row=p["r"],
                grid_col=p["c"],
                dimensions_meters=p["dim"],
                row_identifiers=p["rows"],
                assigned_rover_id="rover-001"
            )
            db.add(new_plot)
    db.commit()

    # 3. Seed historical telemetry (last 24 hours in 1-hour increments)
    now = datetime.now(timezone.utc)
    existing_telemetry_count = db.query(Telemetry).filter(Telemetry.is_simulated == True).count()
    if existing_telemetry_count < 24:
        for hour in range(24, 0, -1):
            ts = now - timedelta(hours=hour)
            # Diurnal sinusoidal variation for realistic solar day/night curves
            hour_of_day = ts.hour
            temp = round(21.0 + 8.5 * math.sin((hour_of_day - 8) * math.pi / 12) + random.uniform(-0.4, 0.4), 1)
            humidity = round(75.0 - 20.0 * math.sin((hour_of_day - 8) * math.pi / 12) + random.uniform(-1.0, 1.0), 1)
            soil_moist = round(44.0 + random.uniform(-2.5, 2.5), 1)
            soil_ph = round(6.5 + random.uniform(-0.15, 0.15), 2)
            
            t = Telemetry(
                device_id="rover-001",
                farm_id="farm-001",
                plot_id="plot-001" if hour % 2 == 0 else "plot-002",
                temperature_c=temp,
                humidity_percent=humidity,
                soil_moisture_percent=soil_moist,
                soil_ph=soil_ph,
                raw_moisture_adc=int(3200 - (soil_moist / 100.0) * (3200 - 1400)),
                raw_ph_voltage=round(2.5 - (soil_ph - 7.0) * 0.183, 3),
                is_simulated=True,
                timestamp=ts
            )
            db.add(t)
        db.commit()

    # 4. Seed Rover Status
    rover = db.query(RoverStatus).filter(RoverStatus.device_id == "rover-001").first()
    if not rover:
        rover = RoverStatus(
            device_id="rover-001",
            name="Smart Agri Rover 1",
            is_online=True,
            battery_percent=88.5,
            signal_rssi=-62,
            ip_address="192.168.1.120",
            mode="MANUAL",
            last_heartbeat=now,
            last_command="STOP",
            last_response="System Standby - Ready for Teleoperation"
        )
        db.add(rover)
    else:
        rover.is_online = True
        rover.last_heartbeat = now
        rover.battery_percent = 88.5
        rover.last_response = "System Standby - Ready for Teleoperation"
    db.commit()

    # 5. Seed Demonstration Scans
    existing_scans = db.query(DiseaseScan).filter(DiseaseScan.is_demo == True).count()
    if existing_scans < 4:
        demo_scans_data = [
            {
                "id": "scan-demo-001",
                "plot_id": "plot-001",
                "row_id": "Row A3",
                "crop": "Tomato",
                "predicted": "Early Blight (Alternaria solani)",
                "conf": 0.94,
                "sev": "Moderate",
                "healthy": False,
                "sym": "Concentric rings with chlorotic yellow halo on lower foliage.",
                "rec": "1. Remove affected leaves. 2. Spray copper-based bactericide/fungicide. 3. Avoid overhead watering.",
                "img": "https://images.unsplash.com/photo-1592417817098-8f3d6eb22501?w=600&auto=format&fit=crop&q=80",
                "hours_ago": 3
            },
            {
                "id": "scan-demo-002",
                "plot_id": "plot-002",
                "row_id": "Row B2",
                "crop": "Potato",
                "predicted": "Healthy Potato Foliage",
                "conf": 0.96,
                "sev": "Healthy",
                "healthy": True,
                "sym": "Normal leaf turgor, clean green coloration without lesions.",
                "rec": "Maintain current irrigation and standard field monitoring.",
                "img": "https://images.unsplash.com/photo-1589923188900-85dae523342b?w=600&auto=format&fit=crop&q=80",
                "hours_ago": 5
            },
            {
                "id": "scan-demo-003",
                "plot_id": "plot-003",
                "row_id": "Row C5",
                "crop": "Corn (Maize)",
                "predicted": "Common Rust (Puccinia sorghi)",
                "conf": 0.89,
                "sev": "Moderate",
                "healthy": False,
                "sym": "Elongated reddish-brown rust pustules on both upper and lower leaf surfaces.",
                "rec": "Monitor pustule coverage on upper canopy; apply strobilurin or triazole if >10% area affected.",
                "img": "https://images.unsplash.com/photo-1628178104595-65487779f4ff?w=600&auto=format&fit=crop&q=80",
                "hours_ago": 9
            },
            {
                "id": "scan-demo-004",
                "plot_id": "plot-001",
                "row_id": "Row A1",
                "crop": "Tomato",
                "predicted": "Healthy Tomato Foliage",
                "conf": 0.97,
                "sev": "Healthy",
                "healthy": True,
                "sym": "Vibrant foliage, robust petiole structure, no sign of fungal mycelium.",
                "rec": "Routine monitoring; soil moisture at optimal target.",
                "img": "https://images.unsplash.com/photo-1591857177580-dc82b9ac4e1e?w=600&auto=format&fit=crop&q=80",
                "hours_ago": 14
            }
        ]
        
        for s in demo_scans_data:
            scan = DiseaseScan(
                id=s["id"],
                device_id="rover-001",
                farm_id="farm-001",
                plot_id=s["plot_id"],
                row_id=s["row_id"],
                image_url=s["img"],
                original_filename=f"{s['id']}.jpg",
                predicted_class=s["predicted"],
                confidence=s["conf"],
                severity=s["sev"],
                symptoms=s["sym"],
                recommendations=s["rec"],
                is_healthy=s["healthy"],
                inference_mode="demo_simulation",
                model_version="v1.2.0-demo-seed",
                is_demo=True,
                timestamp=now - timedelta(hours=s["hours_ago"])
            )
            db.add(scan)
        db.commit()

    # 6. Seed Demo Alerts
    existing_alerts = db.query(Alert).count()
    if existing_alerts < 3:
        demo_alerts = [
            Alert(
                alert_type="DISEASE_DETECTED",
                severity="WARNING",
                farm_id="farm-001",
                plot_id="plot-001",
                title="Early Blight Detected in North Tomato Field",
                message="Visual classification detected Early Blight (Alternaria solani) with 94% confidence at Row A3.",
                reading_value=0.94,
                threshold_value=0.70,
                acknowledged=False,
                timestamp=now - timedelta(hours=3)
            ),
            Alert(
                alert_type="SOIL_MOISTURE_LOW",
                severity="WARNING",
                farm_id="farm-001",
                plot_id="plot-002",
                title="Low Soil Moisture - East Potato Block",
                message="Soil moisture dropped to 26.4%, below the 30.0% threshold. Automated drip valve recommended.",
                reading_value=26.4,
                threshold_value=30.0,
                acknowledged=False,
                timestamp=now - timedelta(hours=6)
            ),
            Alert(
                alert_type="HIGH_TEMPERATURE",
                severity="WARNING",
                farm_id="farm-001",
                plot_id="plot-003",
                title="Elevated Canopy Temperature",
                message="Temperature reached 39.2°C at 13:00, exceeding thermal stress threshold (38.0°C).",
                reading_value=39.2,
                threshold_value=38.0,
                acknowledged=True,
                acknowledged_at=now - timedelta(hours=7),
                timestamp=now - timedelta(hours=8)
            )
        ]
        for a in demo_alerts:
            db.add(a)
        db.commit()

    return {"message": "Demo environment successfully seeded with realistic EPICS sample data."}

@router.post("/telemetry-tick")
def generate_telemetry_tick(db: Session = Depends(get_db)):
    """Generates a single realistic simulated reading so live monitoring updates dynamically."""
    now = datetime.now(timezone.utc)
    temp = round(27.0 + random.uniform(-1.5, 1.5), 1)
    humidity = round(64.0 + random.uniform(-3.0, 3.0), 1)
    moist = round(43.0 + random.uniform(-2.0, 2.0), 1)
    ph = round(6.6 + random.uniform(-0.1, 0.1), 2)
    
    t = Telemetry(
        device_id="rover-001",
        farm_id="farm-001",
        plot_id=random.choice(["plot-001", "plot-002", "plot-003"]),
        temperature_c=temp,
        humidity_percent=humidity,
        soil_moisture_percent=moist,
        soil_ph=ph,
        raw_moisture_adc=int(3200 - (moist / 100.0) * (3200 - 1400)),
        raw_ph_voltage=round(2.5 - (ph - 7.0) * 0.183, 3),
        is_simulated=True,
        timestamp=now
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    
    # Process potential alerts
    process_telemetry_alerts(db, t)
    
    # Refresh rover heartbeat
    rover = db.query(RoverStatus).filter(RoverStatus.device_id == "rover-001").first()
    if rover:
        rover.last_heartbeat = now
        rover.is_online = True
        db.commit()

    return t

@router.post("/toggle")
def toggle_demo_mode(enabled: bool, simulate_rover_online: bool = True, db: Session = Depends(get_db)):
    """Toggles demo mode flag and simulates rover online/offline state."""
    settings.DEMO_MODE_DEFAULT = enabled
    rover = db.query(RoverStatus).filter(RoverStatus.device_id == settings.DEFAULT_DEVICE_ID).first()
    if rover:
        if enabled and simulate_rover_online:
            rover.is_online = True
            rover.last_heartbeat = datetime.now(timezone.utc)
        elif not enabled:
            # Leave live check to actual hardware heartbeat
            pass
        db.commit()
    return {"demo_mode": settings.DEMO_MODE_DEFAULT, "rover_online": rover.is_online if rover else False}

@router.post("/clear-simulated")
def clear_simulated_data(db: Session = Depends(get_db)):
    """Cleans up simulated demo telemetry and scans, leaving genuine hardware measurements intact."""
    deleted_telemetry = db.query(Telemetry).filter(Telemetry.is_simulated == True).delete()
    deleted_scans = db.query(DiseaseScan).filter(DiseaseScan.is_demo == True).delete()
    db.commit()
    return {
        "deleted_simulated_telemetry": deleted_telemetry,
        "deleted_demo_scans": deleted_scans
    }
