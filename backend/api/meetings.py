import json
import os
import shutil
import uuid
from pathlib import Path
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from database import SessionLocal, get_db
from agents.minutes_agent import build_minutes_input, generate_minutes_draft
from agents.stt_agent import transcribe_audio
import models
import schemas

router = APIRouter(prefix="/api/meetings", tags=["meetings"])

UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

ALLOWED_AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".mp4", ".mpeg", ".mpga", ".webm", ".ogg", ".flac"}


def _safe_audio_filename(filename: str) -> str:
    original_name = Path(filename or "").name
    ext = Path(original_name).suffix.lower()
    if ext not in ALLOWED_AUDIO_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_AUDIO_EXTENSIONS))
        raise HTTPException(status_code=400, detail=f"지원하지 않는 음성 파일 형식입니다. ({allowed})")
    stem = Path(original_name).stem.replace(" ", "_") or "audio"
    return f"{uuid.uuid4().hex}_{stem}{ext}"


def _display_audio_filename(audio_path: str) -> str:
    name = Path(audio_path).name
    parts = name.split("_", 1)
    if len(parts) == 2 and len(parts[0]) == 32:
        return parts[1]
    return name


def _sync_meeting_status(db: Session, meeting_id: int):
    files = db.query(models.MeetingFile).filter(models.MeetingFile.meeting_id == meeting_id).all()
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        return
    statuses = {f.stt_status for f in files}
    if "processing" in statuses or "pending" in statuses:
        meeting.status = "processing"
    elif "done" in statuses:
        meeting.status = "review"
    else:
        meeting.status = "pending"


def build_meeting_transcript(db: Session, meeting_id: int) -> models.MeetingTranscript:
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="회의를 찾을 수 없습니다.")

    files = (
        db.query(models.MeetingFile)
        .filter(models.MeetingFile.meeting_id == meeting_id)
        .order_by(models.MeetingFile.file_order.asc(), models.MeetingFile.created_at.asc())
        .all()
    )
    done_files = [f for f in files if f.stt_status == "done" and f.stt_transcript.strip()]
    blocking_files = [f for f in files if f.stt_status in {"pending", "processing"}]

    transcript = (
        db.query(models.MeetingTranscript)
        .filter(models.MeetingTranscript.meeting_id == meeting_id)
        .first()
    )
    if not transcript:
        transcript = models.MeetingTranscript(meeting_id=meeting_id)
        db.add(transcript)

    if blocking_files or not done_files:
        transcript.status = "blocked"
        transcript.source_file_count = len(done_files)
        transcript.content_text = ""
        transcript.content_json = json.dumps(
            {
                "segments": [],
                "blocked_file_ids": [f.id for f in blocking_files],
                "error_file_ids": [f.id for f in files if f.stt_status == "error"],
            },
            ensure_ascii=False,
        )
        db.flush()
        return transcript

    segments = [
        {
            "file_id": f.id,
            "file_order": f.file_order,
            "file_name": _display_audio_filename(f.audio_path),
            "transcript": f.stt_transcript.strip(),
        }
        for f in done_files
    ]
    content_text = "\n\n".join(
        f"[파일 {segment['file_order']}: {segment['file_name']}]\n{segment['transcript']}"
        for segment in segments
    )

    transcript.status = "ready"
    transcript.source_file_count = len(done_files)
    transcript.content_text = content_text
    transcript.content_json = json.dumps({"segments": segments}, ensure_ascii=False)
    db.flush()
    return transcript


def process_stt_file(file_id: int):
    db = SessionLocal()
    try:
        meeting_file = db.query(models.MeetingFile).filter(models.MeetingFile.id == file_id).first()
        if not meeting_file:
            return
        meeting_file.stt_status = "processing"
        meeting_file.stt_transcript = ""
        _sync_meeting_status(db, meeting_file.meeting_id)
        db.commit()

        try:
            transcript = transcribe_audio(meeting_file.audio_path)
        except Exception as exc:
            meeting_file.stt_status = "error"
            meeting_file.stt_transcript = f"STT 처리 실패: {exc}"
        else:
            meeting_file.stt_status = "done"
            meeting_file.stt_transcript = transcript

        _sync_meeting_status(db, meeting_file.meeting_id)
        if meeting_file.stt_status == "done":
            build_meeting_transcript(db, meeting_file.meeting_id)
        db.commit()
    finally:
        db.close()


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
        .options(
            joinedload(models.Meeting.team),
            joinedload(models.Meeting.template),
            joinedload(models.Meeting.files),
            joinedload(models.Meeting.transcript),
            joinedload(models.Meeting.minutes),
        )
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
    meeting_dir = UPLOADS_DIR / str(meeting_id)
    if meeting_dir.exists():
        shutil.rmtree(meeting_dir)
    db.delete(meeting)
    db.commit()


@router.get("/{meeting_id}/files", response_model=list[schemas.MeetingFileOut])
def list_meeting_files(meeting_id: int, db: Session = Depends(get_db)):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="회의를 찾을 수 없습니다.")
    return (
        db.query(models.MeetingFile)
        .filter(models.MeetingFile.meeting_id == meeting_id)
        .order_by(models.MeetingFile.file_order.asc(), models.MeetingFile.created_at.asc())
        .all()
    )


@router.get("/{meeting_id}/transcript", response_model=schemas.MeetingTranscriptOut)
def get_meeting_transcript(meeting_id: int, db: Session = Depends(get_db)):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="회의를 찾을 수 없습니다.")
    transcript = (
        db.query(models.MeetingTranscript)
        .filter(models.MeetingTranscript.meeting_id == meeting_id)
        .first()
    )
    if not transcript:
        transcript = build_meeting_transcript(db, meeting_id)
        db.commit()
        db.refresh(transcript)
    return transcript


@router.post("/{meeting_id}/transcript/build", response_model=schemas.MeetingTranscriptOut)
def rebuild_meeting_transcript(meeting_id: int, db: Session = Depends(get_db)):
    transcript = build_meeting_transcript(db, meeting_id)
    db.commit()
    db.refresh(transcript)
    return transcript


@router.get("/{meeting_id}/minutes", response_model=list[schemas.MeetingMinutesOut])
def list_meeting_minutes(meeting_id: int, db: Session = Depends(get_db)):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="회의를 찾을 수 없습니다.")
    return (
        db.query(models.MeetingMinutes)
        .filter(models.MeetingMinutes.meeting_id == meeting_id)
        .order_by(models.MeetingMinutes.version.desc(), models.MeetingMinutes.created_at.desc())
        .all()
    )


@router.post("/{meeting_id}/minutes/draft", response_model=schemas.MeetingMinutesOut)
def generate_meeting_minutes_draft(meeting_id: int, db: Session = Depends(get_db)):
    meeting = (
        db.query(models.Meeting)
        .options(joinedload(models.Meeting.team), joinedload(models.Meeting.transcript))
        .filter(models.Meeting.id == meeting_id)
        .first()
    )
    if not meeting:
        raise HTTPException(status_code=404, detail="회의를 찾을 수 없습니다.")

    transcript = meeting.transcript or build_meeting_transcript(db, meeting_id)
    if transcript.status != "ready":
        raise HTTPException(status_code=400, detail="통합 transcript가 준비되지 않았습니다.")

    minutes_input = build_minutes_input(meeting, transcript)
    draft = generate_minutes_draft(minutes_input)
    payload = {
        "input": minutes_input,
        "draft": draft,
    }

    last_minutes = (
        db.query(models.MeetingMinutes)
        .filter(models.MeetingMinutes.meeting_id == meeting_id)
        .order_by(models.MeetingMinutes.version.desc())
        .first()
    )
    next_version = (last_minutes.version if last_minutes else 0) + 1
    minutes = models.MeetingMinutes(
        meeting_id=meeting_id,
        content_json=json.dumps(payload, ensure_ascii=False),
        version=next_version,
    )
    db.add(minutes)
    meeting.status = "review"
    db.commit()
    db.refresh(minutes)
    return minutes


@router.post("/{meeting_id}/files", response_model=list[schemas.MeetingFileOut], status_code=201)
async def upload_meeting_files(
    meeting_id: int,
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="회의를 찾을 수 없습니다.")
    if not files:
        raise HTTPException(status_code=400, detail="업로드할 음성 파일을 선택하세요.")

    max_order = (
        db.query(models.MeetingFile.file_order)
        .filter(models.MeetingFile.meeting_id == meeting_id)
        .order_by(models.MeetingFile.file_order.desc())
        .first()
    )
    next_order = (max_order[0] if max_order else 0) + 1

    created_files = []
    meeting_dir = UPLOADS_DIR / str(meeting_id)
    meeting_dir.mkdir(exist_ok=True)

    for upload in files:
        safe_name = _safe_audio_filename(upload.filename or "")
        dest_path = meeting_dir / safe_name
        with dest_path.open("wb") as dest:
            while chunk := await upload.read(1024 * 1024):
                dest.write(chunk)

        meeting_file = models.MeetingFile(
            meeting_id=meeting_id,
            file_order=next_order,
            audio_path=str(dest_path),
            stt_status="pending",
        )
        db.add(meeting_file)
        db.flush()
        created_files.append(meeting_file)
        background_tasks.add_task(process_stt_file, meeting_file.id)
        next_order += 1

    meeting.status = "processing"
    db.commit()
    for meeting_file in created_files:
        db.refresh(meeting_file)
    return created_files


@router.post("/{meeting_id}/files/{file_id}/stt", response_model=schemas.MeetingFileOut)
def retry_stt_file(
    meeting_id: int,
    file_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    meeting_file = (
        db.query(models.MeetingFile)
        .filter(models.MeetingFile.id == file_id, models.MeetingFile.meeting_id == meeting_id)
        .first()
    )
    if not meeting_file:
        raise HTTPException(status_code=404, detail="음성 파일을 찾을 수 없습니다.")
    if not os.path.exists(meeting_file.audio_path):
        raise HTTPException(status_code=404, detail="저장된 음성 파일을 찾을 수 없습니다.")

    meeting_file.stt_status = "pending"
    meeting_file.stt_transcript = ""
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if meeting:
        meeting.status = "processing"
    db.commit()
    db.refresh(meeting_file)
    background_tasks.add_task(process_stt_file, meeting_file.id)
    return meeting_file
