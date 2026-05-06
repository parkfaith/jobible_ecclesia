import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from database import get_db
import models
import schemas

router = APIRouter(prefix="/api/meetings", tags=["meetings"])


@router.get("", response_model=list[schemas.MeetingOut])
def list_meetings(
    team_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(models.Meeting)
    if team_id is not None:
        q = q.filter(models.Meeting.team_id == team_id)
    if status:
        q = q.filter(models.Meeting.status == status)
    return q.order_by(models.Meeting.date.desc(), models.Meeting.created_at.desc()).all()


@router.post("", response_model=schemas.MeetingOut, status_code=201)
def create_meeting(body: schemas.MeetingCreate, db: Session = Depends(get_db)):
    team = db.query(models.Team).filter(models.Team.id == body.team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="팀을 찾을 수 없습니다.")
    if body.template_id:
        tpl = db.query(models.Template).filter(models.Template.id == body.template_id).first()
        if not tpl:
            raise HTTPException(status_code=404, detail="양식을 찾을 수 없습니다.")

    data = body.model_dump()
    attendees = data.pop("attendees", [])
    meeting = models.Meeting(**data, attendees=json.dumps(attendees, ensure_ascii=False))
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return meeting


@router.get("/{meeting_id}", response_model=schemas.MeetingDetail)
def get_meeting(meeting_id: int, db: Session = Depends(get_db)):
    meeting = (
        db.query(models.Meeting)
        .options(joinedload(models.Meeting.team), joinedload(models.Meeting.template))
        .filter(models.Meeting.id == meeting_id)
        .first()
    )
    if not meeting:
        raise HTTPException(status_code=404, detail="회의를 찾을 수 없습니다.")
    return meeting


@router.put("/{meeting_id}", response_model=schemas.MeetingOut)
def update_meeting(meeting_id: int, body: schemas.MeetingUpdate, db: Session = Depends(get_db)):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="회의를 찾을 수 없습니다.")
    update_data = body.model_dump(exclude_none=True)
    if "team_id" in update_data:
        team = db.query(models.Team).filter(models.Team.id == update_data["team_id"]).first()
        if not team:
            raise HTTPException(status_code=404, detail="팀을 찾을 수 없습니다.")
    if "template_id" in update_data and update_data["template_id"] is not None:
        tpl = db.query(models.Template).filter(models.Template.id == update_data["template_id"]).first()
        if not tpl:
            raise HTTPException(status_code=404, detail="양식을 찾을 수 없습니다.")
    if "attendees" in update_data:
        update_data["attendees"] = json.dumps(update_data["attendees"], ensure_ascii=False)
    for key, val in update_data.items():
        setattr(meeting, key, val)
    db.commit()
    db.refresh(meeting)
    return meeting


@router.delete("/{meeting_id}", status_code=204)
def delete_meeting(meeting_id: int, db: Session = Depends(get_db)):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="회의를 찾을 수 없습니다.")
    db.delete(meeting)
    db.commit()
