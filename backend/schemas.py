from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


# ── Team ─────────────────────────────────────────────
class TeamCreate(BaseModel):
    name: str
    description: str = ""


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class TeamOut(BaseModel):
    id: int
    name: str
    description: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Template ─────────────────────────────────────────
class TemplateOut(BaseModel):
    id: int
    name: str
    file_path: str
    is_default: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Meeting ───────────────────────────────────────────
class MeetingCreate(BaseModel):
    team_id: int
    template_id: Optional[int] = None
    title: str
    date: str  # YYYY-MM-DD
    attendees: List[str] = Field(default_factory=list)


class MeetingUpdate(BaseModel):
    team_id: Optional[int] = None
    template_id: Optional[int] = None
    title: Optional[str] = None
    date: Optional[str] = None
    attendees: Optional[List[str]] = None
    status: Optional[str] = None


class MeetingOut(BaseModel):
    id: int
    team_id: int
    template_id: Optional[int]
    title: str
    date: str
    attendees: str  # JSON string
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MeetingDetail(MeetingOut):
    team: TeamOut
    template: Optional[TemplateOut] = None
