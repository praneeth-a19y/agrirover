import io
import base64
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from PIL import Image

from app.database import Base, get_db
from app.main import app

# Setup test database
TEST_SQLALCHEMY_DATABASE_URL = "sqlite:///./test_agri_rover.db"
test_engine = create_engine(TEST_SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="module", autouse=True)
def setup_database():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)

client = TestClient(app)

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "Smart Agriculture Rover" in data["project"]
    assert data["status"] == "Operational"

def test_demo_seed_and_overview():
    # Seed sample data
    seed_res = client.post("/api/v1/demo/seed")
    assert seed_res.status_code == 200
    
    # Query overview
    res = client.get("/api/v1/overview")
    assert res.status_code == 200
    data = res.json()
    assert data["total_farms"] >= 1
    assert data["total_plots"] >= 1
    assert "rover_status" in data
    assert "model_status" in data

def test_telemetry_ingestion_and_calibration():
    # Test raw ADC conversion: 2300 ADC count -> calibrated soil moisture
    payload = {
        "device_id": "rover-001",
        "farm_id": "farm-001",
        "plot_id": "plot-001",
        "temperature_c": 28.5,
        "humidity_percent": 65.0,
        "raw_moisture_adc": 2300,  # 3200 dry, 1400 wet -> (3200-2300)/(3200-1400)*100 = 50.0%
        "raw_ph_voltage": 2.50     # ~7.0 pH
    }
    res = client.post("/api/v1/telemetry", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["soil_moisture_percent"] is not None
    assert 48.0 <= data["soil_moisture_percent"] <= 52.0
    assert data["soil_ph"] is not None
    assert 6.8 <= data["soil_ph"] <= 7.2

def test_rover_command_workflow():
    # Dispatch Forward Command
    cmd_payload = {
        "device_id": "rover-001",
        "command": "FORWARD",
        "duration_ms": 1500
    }
    cmd_res = client.post("/api/v1/rover/commands", json=cmd_payload)
    assert cmd_res.status_code == 201
    cmd_data = cmd_res.json()
    cmd_id = cmd_data["id"]
    assert cmd_data["status"] == "PENDING"
    assert cmd_data["duration_ms"] == 1500

    # Poll pending commands (like ESP32 does)
    poll_res = client.get("/api/v1/rover/commands/pending?device_id=rover-001")
    assert poll_res.status_code == 200
    pending_list = poll_res.json()
    assert any(c["id"] == cmd_id for c in pending_list)

    # Acknowledge command from ESP32
    ack_res = client.post(f"/api/v1/rover/commands/{cmd_id}/ack", json={
        "command_id": cmd_id,
        "status": "ACKNOWLEDGED",
        "response_message": "Motors executed 1500ms forward drive"
    })
    assert ack_res.status_code == 200
    assert ack_res.json()["status"] == "ACKNOWLEDGED"

def test_emergency_stop():
    # Dispatch emergency stop
    res = client.post("/api/v1/rover/commands", json={
        "device_id": "rover-001",
        "command": "EMERGENCY_STOP",
        "duration_ms": 100
    })
    assert res.status_code == 201
    assert res.json()["command"] == "EMERGENCY_STOP"

def test_disease_prediction_pipeline():
    # Create a small valid test green leaf image in memory
    img = Image.new("RGB", (100, 100), color=(34, 139, 34))  # Forest Green
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format="JPEG")
    img_byte_arr.seek(0)

    files = {"file": ("test_leaf.jpg", img_byte_arr, "image/jpeg")}
    data = {
        "crop_hint": "Tomato",
        "plot_id": "plot-001",
        "farm_id": "farm-001",
        "is_demo": "true"
    }
    res = client.post("/api/v1/disease/predict", files=files, data=data)
    assert res.status_code == 201
    pred = res.json()
    assert "scan_id" in pred
    assert "predicted_class" in pred
    assert "confidence" in pred
    assert "recommendations" in pred
    assert pred["confidence"] > 0.5
    assert pred["is_demo"] is True
    # Test user's exact EPICS MobileNetV2 schema fields
    assert "diseaseName" in pred
    assert "confidencePercent" in pred
    assert "needsReview" in pred

def test_epics_user_ml_api_compatibility():
    # 1. Test /health endpoint
    health_res = client.get("/health")
    assert health_res.status_code == 200
    h_data = health_res.json()
    assert h_data["status"] == "ready"
    assert h_data["numClasses"] == 38

    # 2. Test JSON base64 image POST /predict
    img = Image.new("RGB", (64, 64), color=(20, 160, 40))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    b64_str = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")

    res = client.post("/predict", json={"image": b64_str})
    assert res.status_code in (200, 201)
    data = res.json()
    assert data["status"] == "success"
    assert "diseaseName" in data
    assert "confidencePercent" in data
    assert "predictedClass" in data
    assert isinstance(data["needsReview"], bool)

    # 3. Test multipart image POST /upload (compatible with ESP32-CAM)
    buf.seek(0)
    files = {"image": ("esp32_leaf.jpg", buf, "image/jpeg")}
    upload_res = client.post("/upload", files=files)
    assert upload_res.status_code in (200, 201)
    u_data = upload_res.json()
    assert u_data["status"] == "success"
    assert "predictedClass" in u_data

def test_alerts_and_acknowledgment():
    # Fetch alerts
    res = client.get("/api/v1/alerts")
    assert res.status_code == 200
    alerts = res.json()
    if len(alerts) > 0:
        alert_id = alerts[0]["id"]
        ack_res = client.post(f"/api/v1/alerts/{alert_id}/ack", json={"acknowledged": True})
        assert ack_res.status_code == 200
        assert ack_res.json()["acknowledged"] is True

def test_analytics_and_csv_export():
    # Query timeseries
    res = client.get("/api/v1/analytics/timeseries?range_filter=24h")
    assert res.status_code == 200
    assert isinstance(res.json(), list)

    # Test CSV export
    csv_res = client.get("/api/v1/analytics/export/csv?data_type=telemetry")
    assert csv_res.status_code == 200
    assert csv_res.headers["content-type"] == "text/csv; charset=utf-8"
    assert "Temperature (C)" in csv_res.text
