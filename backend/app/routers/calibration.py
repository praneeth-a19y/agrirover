from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.calibration_service import (
    get_calibration,
    convert_raw_moisture_adc,
    convert_raw_ph_voltage
)
from app.schemas.schemas import SoilMoistureCalibration, SoilPHCalibration, CalibrationStatusResponse

router = APIRouter(prefix="/calibration", tags=["Sensor Calibration"])

class CalibrationTestInput(BaseModel):
    raw_moisture_adc: Optional[int] = None
    raw_ph_voltage: Optional[float] = None

class CalibrationTestOutput(BaseModel):
    calibrated_moisture_percent: Optional[float] = None
    calibrated_ph: Optional[float] = None

@router.get("", response_model=CalibrationStatusResponse)
def get_sensor_calibrations(db: Session = Depends(get_db)):
    m_cal = get_calibration(db, "soil_moisture")
    ph_cal = get_calibration(db, "soil_ph")
    
    return CalibrationStatusResponse(
        soil_moisture=SoilMoistureCalibration(
            dry_adc=m_cal.dry_adc,
            wet_adc=m_cal.wet_adc,
            notes=m_cal.notes
        ),
        soil_ph=SoilPHCalibration(
            ph4_voltage=ph_cal.ph4_voltage,
            ph7_voltage=ph_cal.ph7_voltage,
            notes=ph_cal.notes
        ),
        updated_at=m_cal.updated_at
    )

@router.post("/soil-moisture", response_model=SoilMoistureCalibration)
def update_moisture_calibration(payload: SoilMoistureCalibration, db: Session = Depends(get_db)):
    cal = get_calibration(db, "soil_moisture")
    cal.dry_adc = payload.dry_adc
    cal.wet_adc = payload.wet_adc
    if payload.notes:
        cal.notes = payload.notes
    db.commit()
    db.refresh(cal)
    return payload

@router.post("/soil-ph", response_model=SoilPHCalibration)
def update_ph_calibration(payload: SoilPHCalibration, db: Session = Depends(get_db)):
    cal = get_calibration(db, "soil_ph")
    cal.ph4_voltage = payload.ph4_voltage
    cal.ph7_voltage = payload.ph7_voltage
    if payload.notes:
        cal.notes = payload.notes
    db.commit()
    db.refresh(cal)
    return payload

@router.post("/test", response_model=CalibrationTestOutput)
def test_calibration(payload: CalibrationTestInput, db: Session = Depends(get_db)):
    result = CalibrationTestOutput()
    if payload.raw_moisture_adc is not None:
        result.calibrated_moisture_percent = convert_raw_moisture_adc(db, payload.raw_moisture_adc)
    if payload.raw_ph_voltage is not None:
        result.calibrated_ph = convert_raw_ph_voltage(db, payload.raw_ph_voltage)
    return result
