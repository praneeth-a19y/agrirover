from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

# --- Telemetry Schemas ---
class TelemetryCreate(BaseModel):
    device_id: str = Field(..., example="rover-001")
    farm_id: Optional[str] = Field(None, example="farm-001")
    plot_id: Optional[str] = Field(None, example="plot-001")
    temperature_c: Optional[float] = Field(None, ge=-20.0, le=70.0, example=29.4)
    humidity_percent: Optional[float] = Field(None, ge=0.0, le=100.0, example=68.0)
    soil_moisture_percent: Optional[float] = Field(None, ge=0.0, le=100.0, example=42.0)
    soil_ph: Optional[float] = Field(None, ge=0.0, le=14.0, example=6.5)
    raw_moisture_adc: Optional[int] = Field(None, ge=0, le=4095, description="ESP32 12-bit ADC raw output")
    raw_ph_voltage: Optional[float] = Field(None, ge=0.0, le=5.0, description="Analog pH probe output voltage in V")
    is_simulated: Optional[bool] = False
    timestamp: Optional[datetime] = None

class TelemetryResponse(BaseModel):
    id: int
    device_id: str
    farm_id: Optional[str] = None
    plot_id: Optional[str] = None
    temperature_c: Optional[float] = None
    humidity_percent: Optional[float] = None
    soil_moisture_percent: Optional[float] = None
    soil_ph: Optional[float] = None
    raw_moisture_adc: Optional[int] = None
    raw_ph_voltage: Optional[float] = None
    is_simulated: bool
    timestamp: datetime

    class Config:
        from_attributes = True


# --- Farm & Plot Schemas ---
class PlotBase(BaseModel):
    id: str
    name: str
    crop_type: str
    grid_row: int = 0
    grid_col: int = 0
    dimensions_meters: str = "25m x 15m"
    row_identifiers: str = "Row 1-4"
    assigned_rover_id: Optional[str] = None

class PlotCreate(PlotBase):
    farm_id: str

class PlotResponse(PlotBase):
    farm_id: str
    created_at: datetime

    class Config:
        from_attributes = True

class FarmBase(BaseModel):
    name: str
    location: str
    area_acres: float = 1.0
    notes: Optional[str] = None

class FarmCreate(FarmBase):
    id: str

class FarmResponse(FarmBase):
    id: str
    created_at: datetime
    plots: List[PlotResponse] = []

    class Config:
        from_attributes = True


# --- Disease Detection Schemas ---
class DiseasePredictionResponse(BaseModel):
    scan_id: str
    predicted_class: str
    confidence: float
    severity: str
    symptoms: str
    recommendations: str
    is_healthy: bool
    model_version: str
    inference_mode: str
    is_demo: bool
    image_url: str
    farm_id: Optional[str] = None
    plot_id: Optional[str] = None
    row_id: Optional[str] = None
    timestamp: datetime
    # Compatibility with EPICS MobileNetV2 Flask API response format
    status: Optional[str] = "success"
    diseaseName: Optional[str] = None
    predictedClass: Optional[str] = None
    confidencePercent: Optional[float] = None
    needsReview: Optional[bool] = None
    pathogen: Optional[str] = None
    note: Optional[str] = None

    class Config:
        from_attributes = True

class DiseaseScanHistoryItem(BaseModel):
    id: str
    device_id: str
    farm_id: Optional[str] = None
    plot_id: Optional[str] = None
    row_id: Optional[str] = None
    image_url: str
    predicted_class: str
    confidence: float
    severity: str
    is_healthy: bool
    inference_mode: str
    is_demo: bool
    timestamp: datetime

    class Config:
        from_attributes = True


# --- Rover Status & Commands ---
class RoverStatusUpdate(BaseModel):
    device_id: str = "rover-001"
    name: Optional[str] = "Smart Agri Rover 1"
    is_online: bool = True
    battery_percent: Optional[float] = Field(None, ge=0.0, le=100.0)
    signal_rssi: Optional[int] = Field(None, ge=-120, le=0)
    ip_address: Optional[str] = None
    mode: Optional[str] = "MANUAL"
    last_command: Optional[str] = None
    last_response: Optional[str] = None

class RoverStatusResponse(BaseModel):
    device_id: str
    name: str
    is_online: bool
    battery_percent: Optional[float]
    signal_rssi: Optional[int]
    ip_address: Optional[str]
    mode: str
    last_heartbeat: Optional[datetime]
    last_command: Optional[str]
    last_response: Optional[str]
    is_stale: bool = False

    class Config:
        from_attributes = True

class RoverCommandCreate(BaseModel):
    device_id: str = "rover-001"
    command: str = Field(..., pattern="^(FORWARD|BACKWARD|LEFT|RIGHT|STOP|EMERGENCY_STOP)$")
    duration_ms: int = Field(1000, ge=100, le=5000)

class RoverCommandResponse(BaseModel):
    id: int
    device_id: str
    command: str
    duration_ms: int
    status: str
    issued_at: datetime
    executed_at: Optional[datetime]
    acknowledged_at: Optional[datetime]
    response_message: Optional[str]

    class Config:
        from_attributes = True

class RoverCommandAck(BaseModel):
    command_id: int
    status: str = Field(..., pattern="^(ACKNOWLEDGED|FAILED)$")
    response_message: Optional[str] = None


# --- Alerts Schemas ---
class AlertResponse(BaseModel):
    id: int
    alert_type: str
    severity: str
    farm_id: Optional[str] = None
    plot_id: Optional[str] = None
    title: str
    message: str
    reading_value: Optional[float] = None
    threshold_value: Optional[float] = None
    acknowledged: bool
    acknowledged_at: Optional[datetime] = None
    timestamp: datetime

    class Config:
        from_attributes = True

class AlertAckRequest(BaseModel):
    acknowledged: bool = True

class AlertConfig(BaseModel):
    moisture_min: float
    moisture_max: float
    ph_min: float
    ph_max: float
    temp_min: float
    temp_max: float
    humidity_min: float
    humidity_max: float
    disease_confidence_threshold: float


# --- Calibration Schemas ---
class SoilMoistureCalibration(BaseModel):
    dry_adc: float = Field(..., description="Raw ADC count in dry air (typically ~3200 for 12-bit)")
    wet_adc: float = Field(..., description="Raw ADC count in water (typically ~1400 for 12-bit)")
    notes: Optional[str] = None

class SoilPHCalibration(BaseModel):
    ph4_voltage: float = Field(..., description="Probe voltage output at pH 4.01 buffer solution (e.g. 3.0V)")
    ph7_voltage: float = Field(..., description="Probe voltage output at pH 7.00 buffer solution (e.g. 2.5V)")
    notes: Optional[str] = None

class CalibrationStatusResponse(BaseModel):
    soil_moisture: SoilMoistureCalibration
    soil_ph: SoilPHCalibration
    updated_at: Optional[datetime] = None


# --- Overview Summary Schema ---
class OverviewSummary(BaseModel):
    total_farms: int
    total_plots: int
    rover_status: RoverStatusResponse
    latest_telemetry: Optional[TelemetryResponse] = None
    latest_scan: Optional[DiseaseScanHistoryItem] = None
    total_scans: int
    healthy_scans: int
    diseased_scans: int
    active_alerts_count: int
    recent_alerts: List[AlertResponse] = []
    is_demo_mode: bool
    model_status: dict
