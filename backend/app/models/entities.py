from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

from app.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class Farm(Base):
    __tablename__ = "farms"
    
    id = Column(String(50), primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    location = Column(String(200), nullable=False)
    area_acres = Column(Float, default=1.0)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    
    plots = relationship("Plot", back_populates="farm", cascade="all, delete-orphan")
    telemetry = relationship("Telemetry", back_populates="farm")
    scans = relationship("DiseaseScan", back_populates="farm")


class Plot(Base):
    __tablename__ = "plots"
    
    id = Column(String(50), primary_key=True, index=True)
    farm_id = Column(String(50), ForeignKey("farms.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    crop_type = Column(String(100), nullable=False)
    grid_row = Column(Integer, default=0)
    grid_col = Column(Integer, default=0)
    dimensions_meters = Column(String(50), default="25m x 15m")
    row_identifiers = Column(String(100), default="Row 1-4")
    assigned_rover_id = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=utc_now)
    
    farm = relationship("Farm", back_populates="plots")
    telemetry = relationship("Telemetry", back_populates="plot")
    scans = relationship("DiseaseScan", back_populates="plot")


class Telemetry(Base):
    __tablename__ = "telemetry"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    device_id = Column(String(50), nullable=False, index=True)
    farm_id = Column(String(50), ForeignKey("farms.id", ondelete="SET NULL"), nullable=True, index=True)
    plot_id = Column(String(50), ForeignKey("plots.id", ondelete="SET NULL"), nullable=True, index=True)
    
    temperature_c = Column(Float, nullable=True)
    humidity_percent = Column(Float, nullable=True)
    soil_moisture_percent = Column(Float, nullable=True)
    soil_ph = Column(Float, nullable=True)
    
    # Raw hardware signals for calibration audit
    raw_moisture_adc = Column(Integer, nullable=True)
    raw_ph_voltage = Column(Float, nullable=True)
    
    is_simulated = Column(Boolean, default=False)
    timestamp = Column(DateTime, default=utc_now, index=True)
    
    farm = relationship("Farm", back_populates="telemetry")
    plot = relationship("Plot", back_populates="telemetry")


class DiseaseScan(Base):
    __tablename__ = "disease_scans"
    
    id = Column(String(64), primary_key=True, index=True)
    device_id = Column(String(50), nullable=False, default="rover-001")
    farm_id = Column(String(50), ForeignKey("farms.id", ondelete="SET NULL"), nullable=True, index=True)
    plot_id = Column(String(50), ForeignKey("plots.id", ondelete="SET NULL"), nullable=True, index=True)
    row_id = Column(String(50), nullable=True)
    
    image_url = Column(String(500), nullable=False)
    original_filename = Column(String(200), nullable=True)
    
    predicted_class = Column(String(120), nullable=False)
    confidence = Column(Float, nullable=False)
    severity = Column(String(50), default="Healthy")
    symptoms = Column(Text, nullable=True)
    recommendations = Column(Text, nullable=True)
    is_healthy = Column(Boolean, default=True)
    
    inference_mode = Column(String(50), default="demo_simulation")  # local_model, demo_simulation, heuristic
    model_version = Column(String(50), default="v1.0")
    is_demo = Column(Boolean, default=False)
    timestamp = Column(DateTime, default=utc_now, index=True)
    
    farm = relationship("Farm", back_populates="scans")
    plot = relationship("Plot", back_populates="scans")


class Alert(Base):
    __tablename__ = "alerts"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    alert_type = Column(String(50), nullable=False, index=True)  # SOIL_MOISTURE_LOW, SOIL_PH_OUT_OF_RANGE, etc.
    severity = Column(String(20), nullable=False, default="WARNING")  # INFO, WARNING, CRITICAL
    farm_id = Column(String(50), nullable=True, index=True)
    plot_id = Column(String(50), nullable=True, index=True)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    reading_value = Column(Float, nullable=True)
    threshold_value = Column(Float, nullable=True)
    acknowledged = Column(Boolean, default=False, index=True)
    acknowledged_at = Column(DateTime, nullable=True)
    timestamp = Column(DateTime, default=utc_now, index=True)


class RoverStatus(Base):
    __tablename__ = "rover_status"
    
    device_id = Column(String(50), primary_key=True, index=True)
    name = Column(String(100), default="Smart Agri Rover 1")
    is_online = Column(Boolean, default=False)
    battery_percent = Column(Float, nullable=True)
    signal_rssi = Column(Integer, nullable=True)
    ip_address = Column(String(45), nullable=True)
    mode = Column(String(20), default="MANUAL")  # MANUAL, AUTOMATIC
    last_heartbeat = Column(DateTime, nullable=True)
    last_command = Column(String(50), nullable=True)
    last_response = Column(String(200), nullable=True)


class RoverCommand(Base):
    __tablename__ = "rover_commands"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    device_id = Column(String(50), nullable=False, index=True)
    command = Column(String(50), nullable=False)  # FORWARD, BACKWARD, LEFT, RIGHT, STOP, EMERGENCY_STOP
    duration_ms = Column(Integer, default=1000)
    status = Column(String(30), default="PENDING", index=True)  # PENDING, EXECUTED, ACKNOWLEDGED, FAILED, TIMED_OUT
    issued_at = Column(DateTime, default=utc_now)
    executed_at = Column(DateTime, nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    response_message = Column(String(250), nullable=True)


class SensorCalibration(Base):
    __tablename__ = "sensor_calibration"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    sensor_type = Column(String(50), nullable=False, unique=True)  # "soil_moisture" or "soil_ph"
    dry_adc = Column(Float, default=3200.0)      # ADC reading in completely dry air/soil
    wet_adc = Column(Float, default=1400.0)      # ADC reading in water/100% saturation
    ph4_voltage = Column(Float, default=3.0)     # Probe voltage at pH 4.01 buffer
    ph7_voltage = Column(Float, default=2.5)     # Probe voltage at pH 6.86 / 7.0 buffer
    notes = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)
