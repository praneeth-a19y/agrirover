from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.entities import RoverStatus, RoverCommand
from app.schemas.schemas import (
    RoverStatusUpdate,
    RoverStatusResponse,
    RoverCommandCreate,
    RoverCommandResponse,
    RoverCommandAck
)
from app.services.rover_manager import (
    get_or_create_rover,
    check_rover_online_state,
    update_rover_heartbeat,
    dispatch_command,
    get_pending_commands,
    acknowledge_command
)
from app.config import settings

router = APIRouter(prefix="/rover", tags=["Rover Hardware Interface"])

@router.post("/status", response_model=RoverStatusResponse)
def update_status(payload: RoverStatusUpdate, db: Session = Depends(get_db)):
    rover = update_rover_heartbeat(
        db=db,
        device_id=payload.device_id,
        battery=payload.battery_percent,
        signal_rssi=payload.signal_rssi,
        ip_address=payload.ip_address,
        mode=payload.mode,
        last_command=payload.last_command,
        last_response=payload.last_response
    )
    is_live = check_rover_online_state(rover)
    return RoverStatusResponse(
        device_id=rover.device_id,
        name=rover.name,
        is_online=is_live,
        battery_percent=rover.battery_percent,
        signal_rssi=rover.signal_rssi,
        ip_address=rover.ip_address,
        mode=rover.mode,
        last_heartbeat=rover.last_heartbeat,
        last_command=rover.last_command,
        last_response=rover.last_response,
        is_stale=not is_live
    )

@router.get("/status", response_model=RoverStatusResponse)
def get_status(
    device_id: str = Query(settings.DEFAULT_DEVICE_ID),
    db: Session = Depends(get_db)
):
    rover = get_or_create_rover(db, device_id)
    is_live = check_rover_online_state(rover)
    return RoverStatusResponse(
        device_id=rover.device_id,
        name=rover.name,
        is_online=is_live,
        battery_percent=rover.battery_percent,
        signal_rssi=rover.signal_rssi,
        ip_address=rover.ip_address,
        mode=rover.mode,
        last_heartbeat=rover.last_heartbeat,
        last_command=rover.last_command,
        last_response=rover.last_response,
        is_stale=not is_live
    )

@router.post("/commands", response_model=RoverCommandResponse, status_code=status.HTTP_201_CREATED)
def send_command(payload: RoverCommandCreate, db: Session = Depends(get_db)):
    """Dispatches a motion or safety command to the rover hardware queue."""
    cmd = dispatch_command(
        db=db,
        device_id=payload.device_id,
        command=payload.command,
        duration_ms=payload.duration_ms
    )
    return cmd

@router.get("/commands/pending", response_model=List[RoverCommandResponse])
def poll_pending_commands(
    device_id: str = Query(settings.DEFAULT_DEVICE_ID),
    db: Session = Depends(get_db)
):
    """Polled by the physical ESP32 to fetch pending motion instructions."""
    # Update heartbeat implicitly since ESP32 is polling
    update_rover_heartbeat(db, device_id)
    return get_pending_commands(db, device_id)

@router.post("/commands/{command_id}/ack", response_model=RoverCommandResponse)
def ack_command(command_id: int, ack_payload: RoverCommandAck, db: Session = Depends(get_db)):
    """Called by the physical ESP32 after motor actuation completes."""
    cmd = acknowledge_command(
        db=db,
        command_id=command_id,
        status=ack_payload.status,
        response_msg=ack_payload.response_message
    )
    if not cmd:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Command ID not found")
    return cmd

@router.get("/commands/history", response_model=List[RoverCommandResponse])
def get_command_history(
    device_id: str = Query(settings.DEFAULT_DEVICE_ID),
    limit: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db)
):
    return db.query(RoverCommand).filter(
        RoverCommand.device_id == device_id
    ).order_by(RoverCommand.id.desc()).limit(limit).all()
