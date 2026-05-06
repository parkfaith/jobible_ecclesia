from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from database import Base


class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    meetings = relationship("Meeting", back_populates="team", cascade="all, delete-orphan")


class Template(Base):
    __tablename__ = "templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    file_path = Column(String(500), nullable=False)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    meetings = relationship("Meeting", back_populates="template")


class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    template_id = Column(Integer, ForeignKey("templates.id"), nullable=True)
    title = Column(String(200), nullable=False)
    date = Column(String(20), nullable=False)  # YYYY-MM-DD
    attendees = Column(Text, default="[]")  # JSON string
    status = Column(String(20), default="pending")  # pending|processing|review|done
    created_at = Column(DateTime, default=datetime.utcnow)

    team = relationship("Team", back_populates="meetings")
    template = relationship("Template", back_populates="meetings")
    files = relationship("MeetingFile", back_populates="meeting", cascade="all, delete-orphan")
    minutes = relationship("MeetingMinutes", back_populates="meeting", cascade="all, delete-orphan")
    action_items = relationship("ActionItem", back_populates="meeting", cascade="all, delete-orphan")


class MeetingFile(Base):
    __tablename__ = "meeting_files"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=False)
    file_order = Column(Integer, default=0)
    audio_path = Column(String(500), nullable=False)
    stt_transcript = Column(Text, default="")
    stt_status = Column(String(20), default="pending")  # pending|processing|done|error
    created_at = Column(DateTime, default=datetime.utcnow)

    meeting = relationship("Meeting", back_populates="files")


class MeetingMinutes(Base):
    __tablename__ = "meeting_minutes"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=False)
    content_json = Column(Text, default="{}")
    docx_path = Column(String(500), default="")
    version = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

    meeting = relationship("Meeting", back_populates="minutes")


class ActionItem(Base):
    __tablename__ = "action_items"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=False)
    assignee = Column(String(100), default="")
    item = Column(Text, nullable=False)
    detail = Column(Text, default="")
    deadline = Column(String(20), default="")  # YYYY-MM-DD

    meeting = relationship("Meeting", back_populates="action_items")
