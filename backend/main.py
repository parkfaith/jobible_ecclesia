from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from database import init_db
from api import teams, meetings, templates

app = FastAPI(title="Ecclesia API", version="1.0.0")

# CORS - Next.js dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(teams.router)
app.include_router(meetings.router)
app.include_router(templates.router)

# 정적 파일 (생성된 docx 다운로드용 - Phase 5)
outputs_dir = os.path.join(os.path.dirname(__file__), "outputs")
os.makedirs(outputs_dir, exist_ok=True)
app.mount("/outputs", StaticFiles(directory=outputs_dir), name="outputs")


@app.on_event("startup")
def startup():
    init_db()


@app.get("/health")
def health():
    return {"status": "ok", "service": "Ecclesia API"}
