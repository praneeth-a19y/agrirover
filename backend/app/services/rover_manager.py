from datetime import datetime, timezone, timedelta
from typing import Optional, List
from sqlalchemy.orm import Session

from app.models.entities import RoverStatus, RoverCommand
from app.config import settings

def get_or_create_rover(db: Session, device_id: str = settings.DEFAULT_DEVICE_ID) -> RoverStatus:
    rover = db.query(RoverStatus).filter(RoverStatus.device_id == device_id).first()
    if not rover:
        rover = RoverStatus(
            device_id=device_id,
            name="Smart Agri Rover 1",
            is_online=False,
            battery_percent=92.0,
            signal_rssi=-65,
            ip_address="192.168.1.100",
            mode="MANUAL"
        )
        db.add(rover)
        db.commit()
        db.refresh(rover)
    return rover

def check_rover_online_state(rover: RoverStatus) -> bool:
    """Calculates if the physical rover is online based on heartbeat recency."""
    if not rover.last_heartbeat:
        return rover.is_online
    
    elapsed = (datetime.now(timezone.utc) - rover.last_heartbeat.replace(tzinfo=timezone.utc if rover.last_heartbeat.tzinfo is None else None)).total_seconds()
    return elapsed <= settings.ROVER_OFFLINE_THRESHOLD_SECONDS

def update_rover_heartbeat(
    db: Session,
    device_id: str,
    battery: Optional[float] = None,
    signal_rssi: Optional[int] = None,
    ip_address: Optional[str] = None,
    mode: Optional[str] = None,
    last_command: Optional[str] = None,
    last_response: Optional[str] = None
) -> RoverStatus:
    rover = get_or_create_rover(db, device_id)
    rover.is_online = True
    rover.last_heartbeat = datetime.now(timezone.utc)
    if battery is not None:
        rover.battery_percent = battery
    if signal_rssi is not None:
        rover.signal_rssi = signal_rssi
    if ip_address:
        rover.ip_address = ip_address
    if mode:
        rover.mode = mode
    if last_command:
        rover.last_command = last_command
    if last_response:
        rover.last_response = last_response
        
    db.commit()
    db.refresh(rover)
    return rover

def dispatch_command(
    db: Session,
    device_id: str,
    command: str,
    duration_ms: int = 1000
) -> RoverCommand:
    """Dispatches a motion or safety command to the rover command queue."""
    # Enforce safe duration ceiling
    clamped_duration = min(duration_ms, settings.MAX_MOVEMENT_DURATION_MS)
    
    rover = get_or_create_rover(db, device_id)
    is_live = check_rover_online_state(rover)
    
    # If EMERGENCY_STOP, cancel any pending commands right away
    if command in ("EMERGENCY_STOP", "STOP"):
        db.query(RoverCommand).filter(
            RoverCommand.device_id == device_id,
            RoverCommand.status == "PENDING"
        ).update({"status": "CANCELED"})
    
    # Create the new command
    new_cmd = RoverCommand(
        device_id=device_id,
        command=command,
        duration_ms=clamped_duration,
        status="PENDING",
        issued_at=datetime.now(timezone.utc),
        response_message="Queued for rover dispatch" if is_live else "Warning: Rover offline. Command queued."
    )
    db.add(new_cmd)
    
    rover.last_command = command
    db.commit()
    db.refresh(new_cmd)
    return new_cmd

def get_pending_commands(db: Session, device_id: str) -> List[RoverCommand]:
    """Retrieves pending commands for the physical ESP32 rover polling loop."""
    # Check for timed out commands first
    timeout_cutoff = datetime.now(timezone.utc) - timedelta(seconds=settings.COMMAND_TIMEOUT_SECONDS)
    db.query(RoverCommand).filter(
        RoverCommand.device_id == device_id,
        RoverCommand.status == "PENDING",
        RoverCommand.issued_at < timeout_cutoff
    ).update({"status": "TIMED_OUT", "response_message": "Command timed out before execution"})
    db.commit()

    return db.query(RoverCommand).filter(
        RoverCommand.device_id == device_id,
        RoverCommand.status == "PENDING"
    ).order_by(RoverCommand.id.asc()).all()

def acknowledge_command(
    db: Session,
    command_id: int,
    status: str,
    response_msg: Optional[str] = None
) -> Optional[RoverCommand]:
    cmd = db.query(RoverCommand).filter(RoverCommand.id == command_id).first()
    if cmd:
        cmd.status = status
        cmd.acknowledged_at = datetime.now(timezone.utc)
        cmd.executed_at = datetime.now(timezone.utc)
        if response_msg:
            cmd.response_message = response_msg
        db.commit()
        db.refresh(cmd)
    return cmd
