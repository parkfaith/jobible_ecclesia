import os
import shutil
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas

router = APIRouter(prefix="/api/templates", tags=["templates"])

TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "..", "templates")
os.makedirs(TEMPLATES_DIR, exist_ok=True)


@router.get("", response_model=list[schemas.TemplateOut])
def list_templates(db: Session = Depends(get_db)):
    return db.query(models.Template).order_by(models.Template.is_default.desc(), models.Template.created_at.desc()).all()


@router.post("/upload", response_model=schemas.TemplateOut, status_code=201)
async def upload_template(
    name: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    original_name = Path(file.filename or "").name
    if not original_name.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail=".docx 파일만 업로드 가능합니다.")

    safe_name = original_name.replace(" ", "_")
    if not safe_name or safe_name in {".docx", "_"}:
        raise HTTPException(status_code=400, detail="유효한 파일명이 아닙니다.")

    dest_path = os.path.join(TEMPLATES_DIR, safe_name)

    # 같은 이름 파일이 있으면 suffix 추가
    base, ext = os.path.splitext(safe_name)
    counter = 1
    while os.path.exists(dest_path):
        dest_path = os.path.join(TEMPLATES_DIR, f"{base}_{counter}{ext}")
        counter += 1

    with open(dest_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    is_first = db.query(models.Template).count() == 0
    template = models.Template(name=name, file_path=dest_path, is_default=is_first)
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.put("/{template_id}/default", response_model=schemas.TemplateOut)
def set_default(template_id: int, db: Session = Depends(get_db)):
    template = db.query(models.Template).filter(models.Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="양식을 찾을 수 없습니다.")
    # 기존 기본값 해제
    db.query(models.Template).filter(models.Template.is_default == True).update({"is_default": False})
    template.is_default = True
    db.commit()
    db.refresh(template)
    return template


@router.delete("/{template_id}", status_code=204)
def delete_template(template_id: int, db: Session = Depends(get_db)):
    template = db.query(models.Template).filter(models.Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="양식을 찾을 수 없습니다.")
    was_default = template.is_default
    if os.path.exists(template.file_path):
        os.remove(template.file_path)
    db.delete(template)
    db.flush()
    if was_default:
        next_template = db.query(models.Template).order_by(models.Template.created_at.desc()).first()
        if next_template:
            next_template.is_default = True
    db.commit()
