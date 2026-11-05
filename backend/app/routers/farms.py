from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.entities import Farm, Plot, Telemetry, DiseaseScan
from app.schemas.schemas import (
    FarmCreate,
    FarmResponse,
    PlotCreate,
    PlotResponse,
    TelemetryResponse,
    DiseaseScanHistoryItem
)

router = APIRouter(prefix="/farms", tags=["Farm & Plot Management"])

@router.get("", response_model=List[FarmResponse])
def list_farms(db: Session = Depends(get_db)):
    return db.query(Farm).all()

@router.post("", response_model=FarmResponse, status_code=status.HTTP_201_CREATED)
def create_farm(payload: FarmCreate, db: Session = Depends(get_db)):
    existing = db.query(Farm).filter(Farm.id == payload.id).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Farm ID already exists")
    
    farm = Farm(
        id=payload.id,
        name=payload.name,
        location=payload.location,
        area_acres=payload.area_acres,
        notes=payload.notes
    )
    db.add(farm)
    db.commit()
    db.refresh(farm)
    return farm

@router.get("/plots", response_model=List[PlotResponse])
def list_plots(farm_id: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Plot)
    if farm_id:
        query = query.filter(Plot.farm_id == farm_id)
    return query.all()

@router.post("/plots", response_model=PlotResponse, status_code=status.HTTP_201_CREATED)
def create_plot(payload: PlotCreate, db: Session = Depends(get_db)):
    farm = db.query(Farm).filter(Farm.id == payload.farm_id).first()
    if not farm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Associated farm not found")
        
    existing = db.query(Plot).filter(Plot.id == payload.id).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Plot ID already exists")
        
    plot = Plot(
        id=payload.id,
        farm_id=payload.farm_id,
        name=payload.name,
        crop_type=payload.crop_type,
        grid_row=payload.grid_row,
        grid_col=payload.grid_col,
        dimensions_meters=payload.dimensions_meters,
        row_identifiers=payload.row_identifiers,
        assigned_rover_id=payload.assigned_rover_id
    )
    db.add(plot)
    db.commit()
    db.refresh(plot)
    return plot

@router.get("/plots/{plot_id}/summary")
def get_plot_summary(plot_id: str, db: Session = Depends(get_db)):
    plot = db.query(Plot).filter(Plot.id == plot_id).first()
    if not plot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plot not found")
        
    latest_telemetry = db.query(Telemetry).filter(Telemetry.plot_id == plot_id).order_by(Telemetry.timestamp.desc()).first()
    recent_scans = db.query(DiseaseScan).filter(DiseaseScan.plot_id == plot_id).order_by(DiseaseScan.timestamp.desc()).limit(5).all()
    
    return {
        "plot": PlotResponse.model_validate(plot),
        "latest_telemetry": TelemetryResponse.model_validate(latest_telemetry) if latest_telemetry else None,
        "recent_scans": [DiseaseScanHistoryItem.model_validate(s) for s in recent_scans]
    }
