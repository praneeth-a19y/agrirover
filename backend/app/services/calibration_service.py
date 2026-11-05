from sqlalchemy.orm import Session
from datetime import datetime, timezone
from app.models.entities import SensorCalibration

DEFAULT_DRY_ADC = 3200.0
DEFAULT_WET_ADC = 1400.0
DEFAULT_PH4_VOLTAGE = 3.05
DEFAULT_PH7_VOLTAGE = 2.50

def get_calibration(db: Session, sensor_type: str) -> SensorCalibration:
    cal = db.query(SensorCalibration).filter(SensorCalibration.sensor_type == sensor_type).first()
    if not cal:
        if sensor_type == "soil_moisture":
            cal = SensorCalibration(
                sensor_type="soil_moisture",
                dry_adc=DEFAULT_DRY_ADC,
                wet_adc=DEFAULT_WET_ADC,
                notes="Standard 12-bit capacitive soil moisture probe calibration"
            )
        else:
            cal = SensorCalibration(
                sensor_type="soil_ph",
                ph4_voltage=DEFAULT_PH4_VOLTAGE,
                ph7_voltage=DEFAULT_PH7_VOLTAGE,
                notes="Analog glass electrode pH probe calibration using 4.01 and 7.0 buffers"
            )
        db.add(cal)
        db.commit()
        db.refresh(cal)
    return cal

def convert_raw_moisture_adc(db: Session, raw_adc: int) -> float:
    """Converts raw 12-bit ADC reading to calibrated soil moisture percentage."""
    cal = get_calibration(db, "soil_moisture")
    dry = cal.dry_adc
    wet = cal.wet_adc
    
    if dry == wet:
        return 50.0
        
    moisture = ((dry - raw_adc) / (dry - wet)) * 100.0
    return max(0.0, min(100.0, round(moisture, 1)))

def convert_raw_ph_voltage(db: Session, raw_voltage: float) -> float:
    """Converts raw sensor output voltage to calibrated pH value."""
    cal = get_calibration(db, "soil_ph")
    v4 = cal.ph4_voltage
    v7 = cal.ph7_voltage
    
    # Slope = (V7 - V4) / (7.00 - 4.01)  (Typically negative or defined in mV/pH)
    voltage_diff = v7 - v4
    if abs(voltage_diff) < 0.05:
        # Fallback linear approximation if uncalibrated
        slope = -0.183
    else:
        slope = voltage_diff / (7.00 - 4.01)
        
    ph = 7.0 + (raw_voltage - v7) / slope
    return max(0.0, min(14.0, round(ph, 2)))
