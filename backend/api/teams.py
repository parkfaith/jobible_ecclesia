from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas

router = APIRouter(prefix="/api/teams", tags=["teams"])


@router.get("", response_model=list[schemas.TeamOut])
def list_teams(db: Session = Depends(get_db)):
    return db.query(models.Team).order_by(models.Team.created_at.desc()).all()


@router.post("", response_model=schemas.TeamOut, status_code=201)
def create_team(body: schemas.TeamCreate, db: Session = Depends(get_db)):
    if db.query(models.Team).filter(models.Team.name == body.name).first():
        raise HTTPException(status_code=400, detail="팀 이름이 이미 존재합니다.")
    team = models.Team(**body.model_dump())
    db.add(team)
    db.commit()
    db.refresh(team)
    return team


@router.get("/{team_id}", response_model=schemas.TeamOut)
def get_team(team_id: int, db: Session = Depends(get_db)):
    team = db.query(models.Team).filter(models.Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="팀을 찾을 수 없습니다.")
    return team


@router.put("/{team_id}", response_model=schemas.TeamOut)
def update_team(team_id: int, body: schemas.TeamUpdate, db: Session = Depends(get_db)):
    team = db.query(models.Team).filter(models.Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="팀을 찾을 수 없습니다.")
    update_data = body.model_dump(exclude_none=True)
    if "name" in update_data:
        existing = db.query(models.Team).filter(
            models.Team.name == update_data["name"],
            models.Team.id != team_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="팀 이름이 이미 존재합니다.")
    for key, val in update_data.items():
        setattr(team, key, val)
    db.commit()
    db.refresh(team)
    return team


@router.delete("/{team_id}", status_code=204)
def delete_team(team_id: int, db: Session = Depends(get_db)):
    team = db.query(models.Team).filter(models.Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="팀을 찾을 수 없습니다.")
    db.delete(team)
    db.commit()
