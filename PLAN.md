# Ecclesia - 회의록 자동화 시스템 기획서

> **Ecclesia** : 고대 헬라어로 "회의"를 뜻함
> PM의 주간 팀 회의를 녹음 파일로부터 자동으로 회의록 Word 파일을 생성하는 시스템

---

## 1. 프로젝트 개요

### 목적
매주 진행되는 팀 회의의 녹음 파일을 자동으로 텍스트 변환하고, 기존 회의록 양식에 맞추어 Word 파일을 생성하는 자동화 시스템 구축

### 핵심 요구사항
1. 회의 녹음 파일 업로드
2. STT(Speech-to-Text)를 이용한 텍스트 변환 (화자 분리 포함)
3. 기존 회의록 양식에 맞춘 회의록 자동 생성
4. Word(.docx) 파일로 출력

### 녹음 파일 처리 원칙
1. **다중 파일 지원**: 하나의 회의에 녹음 파일이 1개 이상 존재할 수 있음
2. **파일 독립성**: 각 녹음 파일은 서로 연관성이 없으며 완전히 독립적으로 처리됨
   - 파일 간 내용을 연결하거나 추론하지 않음
   - 각 파일은 별도의 STT 처리 후 결과를 순서대로 통합
3. **사실 기반 원칙 (Fact-Only)**: 회의록은 반드시 실제 회의 내용만을 기반으로 작성
   - 추측, 예상, 가정 내용은 일절 포함하지 않음
   - 발화되지 않은 내용은 보완하거나 생성하지 않음
   - 불명확한 내용은 `[불명확]` 또는 `[확인 필요]`로 표기

### 시스템 특성
- **아키텍처**: Agent Harness 시스템 (AI 에이전트 오케스트레이션)
- **배포 환경**: 로컬 전용 (우선)
- **지원 언어**: 한국어 전용
- **팀 수**: 제한 없음 (유동적)
- **양식**: 다중 템플릿 지원 (기본 양식 + 추가 업로드 가능)

---

## 2. 시스템 아키텍처 - Agent Harness

여러 AI 에이전트가 각 역할을 나누어 Orchestrator의 지휘 하에 협력하는 구조

```
[사용자]
   │  음성 파일 업로드 + 메타정보 입력
   ▼
[Orchestrator Agent]  ← 전체 파이프라인 조율
   │
   ├──▶ [STT Agent]            음성 → 텍스트 + 타임스탬프  (Groq Whisper)
   │         │
   │    [Diarization Agent]    화자 분리 → 참석자 매핑      (pyannote-audio)
   │         │
   ├──▶ [Refinement Agent]     한국어 정제 + 안건별 구조화  (Claude)
   │
   ├──▶ [Minutes Agent]        양식 기반 회의록 초안 생성   (Claude)
   │         │
   │    [사용자 검토/수정 UI]
   │
   └──▶ [Export Agent]         .docx 파일 생성 및 저장      (python-docx)
```

### 에이전트별 역할

| 에이전트 | 역할 | 사용 기술 |
|----------|------|-----------|
| **Orchestrator** | 전체 흐름 제어, 에이전트 간 데이터 전달 | Python |
| **STT Agent** | 음성 파일 → 텍스트 + 타임스탬프 변환 | Groq Whisper (whisper-large-v3-turbo) |
| **Diarization Agent** | 화자 분리, 참석자 이름 매핑 | pyannote-audio (로컬, 무료) |
| **Refinement Agent** | 한국어 오류 정제, 안건별 구조화 | Claude API |
| **Minutes Agent** | 회의록 양식 기반 초안 생성 | Claude API (claude-sonnet-4-6) |
| **Export Agent** | 확정 내용 → Word 파일 생성 | python-docx |

---

## 3. 기술 스택

| 레이어 | 기술 | 선택 이유 |
|--------|------|-----------|
| **Frontend** | Next.js 14 (App Router) + Tailwind CSS | 빠른 UI 구성, 서버 컴포넌트 활용 |
| **Backend/API** | FastAPI (Python) | AI 라이브러리 호환, 비동기 처리 |
| **STT** | Groq Whisper API (whisper-large-v3-turbo) | 무료, 빠른 속도, 한국어 지원 |
| **화자 분리** | pyannote-audio (로컬 실행) | 무료, 한국어 지원 |
| **LLM** | Claude API (claude-sonnet-4-6) | 회의록 생성 및 텍스트 정제 |
| **Word 생성** | python-docx | 기존 양식(.docx) 유지하며 내용 채우기 |
| **데이터베이스** | SQLite | 로컬 배포 단순화 |
| **파일 저장** | 로컬 파일시스템 | 로컬 배포 우선 |

---

## 4. 회의록 양식 구조

### 기본(Default) 양식
- **파일**: `회의록_DX정기미팅0430.docx`
- **추가 양식**: 사용자가 직접 업로드하여 선택 가능 (확장성 확보)

### 양식 레이아웃

```
[회의록]

┌─────────────────────────────────────────────────────┐
│ 회 의 명 │ [프로젝트명] 정기 미팅 ([날짜])          │
│ 일     시 │ [년도]년 [월]월 [일]일                  │
│ 참  석  자 │ [화자1] ([역할]), [화자2] ([역할]), ... │
│ 주요 안건 │ [안건1], [안건2], ...                   │
└─────────────────────────────────────────────────────┘

1. [안건 제목]
   [하위 항목 / 팀명]
   - [세부 내용]
   - [세부 내용]

2. [안건 제목]
   ...

📌 주요 Action Items
┌──────────┬───────────────┬──────────────┬──────┐
│ 담  당   │  Action Item  │   세부 내용  │ 기한 │
├──────────┼───────────────┼──────────────┼──────┤
│ [담당자] │ [항목]        │ [설명]       │ [일] │
└──────────┴───────────────┴──────────────┴──────┘

이상으로 회의를 마칩니다. 수고하셨습니다.
```

---

## 5. 주요 페이지 구조 (UI)

```
Ecclesia
├── /dashboard          메인 대시보드 (팀별 최근 회의 현황, 처리 중인 회의)
├── /meetings           회의 목록 (팀별 필터, 날짜 검색)
│   ├── /meetings/new   새 회의 시작 (파일 업로드 + 메타정보 입력)
│   └── /meetings/:id   회의 상세 (처리 진행상태 + 결과 검토/편집)
├── /teams              팀 관리 (팀 추가/수정/삭제, 팀원 관리)
├── /templates          회의록 양식 관리 (기본 양식 + 추가 양식 업로드)
└── /settings           시스템 설정 (API 키, 기본값 등)
```

---

## 6. 핵심 워크플로우

### Step 1. 회의 정보 입력
- 팀 선택
- 날짜, 참석자 입력
- 음성 파일(.mp3 / .wav / .m4a) **1개 이상** 업로드 (순서 지정 가능)
- 회의록 양식 선택

### Step 2. STT 변환 (파일별 독립 처리)
- 업로드된 각 파일을 **개별적으로** Groq Whisper API 처리
- 파일 간 내용을 연결하거나 추론하지 않음
- 각 파일의 타임스탬프 포함 세그먼트 추출
- 처리 진행률 파일별 실시간 표시
- 전체 완료 후 파일 순서대로 결과 통합

### Step 3. 화자 분리
- pyannote-audio로 화자별 구간 분리
- 사용자가 "화자 A → 홍길동 (PM)" 형태로 이름 매핑

### Step 4. 텍스트 정제 및 구조화
- 한국어 전문용어 교정
- 대화를 안건별로 자동 분류
- **발화된 내용만** 정제 대상으로 처리 (내용 추가 금지)

### Step 5. 회의록 초안 생성 (Fact-Only)
- Claude가 선택된 양식 구조에 맞게 회의록 초안 작성
- **실제 발화 내용만** 기반으로 작성 (추측·예상 내용 생성 금지)
- 불명확하거나 알아듣기 어려운 부분은 `[불명확]` / `[확인 필요]` 표기
- Action Items 자동 추출 (담당자, 내용, 기한 — 발화된 내용 한정)

### Step 6. 검토 및 수정
- 웹 UI에서 초안 내용 직접 편집
- 섹션별 재생성 요청 가능

### Step 7. Word 파일 출력
- 확정 내용을 .docx 양식에 삽입하여 다운로드
- 회의 이력으로 저장

---

## 7. 프로젝트 폴더 구조

```
ecclesia/
├── PLAN.md                          이 기획서
│
├── frontend/                        Next.js 앱
│   ├── src/
│   │   └── app/
│   │       ├── dashboard/           대시보드
│   │       ├── meetings/            회의 목록 + 상세
│   │       │   ├── new/             새 회의
│   │       │   └── [id]/            회의 상세
│   │       ├── teams/               팀 관리
│   │       ├── templates/           양식 관리
│   │       └── settings/            설정
│   └── package.json
│
├── backend/                         FastAPI 앱
│   ├── agents/
│   │   ├── orchestrator.py          전체 흐름 제어
│   │   ├── stt_agent.py             Groq Whisper 호출
│   │   ├── diarization_agent.py     화자 분리
│   │   ├── refinement_agent.py      텍스트 정제
│   │   ├── minutes_agent.py         회의록 생성 (Claude)
│   │   └── export_agent.py          .docx 출력
│   ├── api/
│   │   ├── meetings.py              회의 API
│   │   ├── teams.py                 팀 API
│   │   └── templates.py             양식 API
│   ├── models/                      DB 모델
│   ├── templates/                   회의록 양식 파일 (.docx)
│   ├── uploads/                     업로드된 음성 파일
│   ├── outputs/                     생성된 Word 파일
│   ├── db/                          SQLite 데이터베이스
│   ├── main.py                      FastAPI 앱 진입점
│   └── requirements.txt
│
└── docker-compose.yml               로컬 실행 구성
```

---

## 8. 개발 Phase 계획

| Phase | 범위 | 주요 작업 |
|-------|------|-----------|
| **Phase 1** | 프로젝트 뼈대 | Next.js + FastAPI 연동, SQLite DB 설계, 팀/회의/양식 CRUD API |
| **Phase 2** | STT 파이프라인 | Groq Whisper 연동, 파일 업로드, 화자 분리 (pyannote-audio), 화자 매핑 UI |
| **Phase 3** | Agent Harness | Orchestrator 구현, 에이전트 체인 연결, 진행 상태 실시간 표시 |
| **Phase 4** | 회의록 생성 | Claude 기반 Minutes Agent, 양식 선택 적용, Action Items 추출 |
| **Phase 5** | Word 출력 + 검토 UI | python-docx 양식 생성, 웹 편집 인터페이스, 다운로드 |

---

## 9. 데이터베이스 설계 (주요 테이블)

```
teams           팀 정보 (id, name, description, created_at)

meetings        회의 정보 (id, team_id, title, date, attendees, status, template_id)
                status: pending | processing | review | done

meeting_files   파일 정보 (id, meeting_id, file_order, audio_path,
                           stt_transcript, stt_status, created_at)
                - file_order: 파일 처리 순서 (다중 파일 순서 보장)
                - stt_status: pending | processing | done | error
                - 각 파일은 독립적으로 STT 처리됨

meeting_minutes 회의록 (id, meeting_id, content_json, docx_path, version, created_at)

templates       양식 정보 (id, name, file_path, is_default, created_at)

action_items    액션아이템 (id, meeting_id, assignee, item, detail, deadline)
```

---

## 10. 주요 외부 API / 라이브러리

| 항목 | 서비스/라이브러리 | 비고 |
|------|------------------|------|
| STT | Groq API (whisper-large-v3-turbo) | 무료 (Rate Limit 내) |
| 화자 분리 | pyannote-audio | 로컬 실행, 무료 |
| LLM | Anthropic Claude API | claude-sonnet-4-6 |
| Word 생성 | python-docx | 오픈소스 |
| 음성 처리 | pydub, ffmpeg | 파일 포맷 변환 |

---

---

## 11. 진행 상황 기록 (Progress Log)

> 작업 공간이 변경되어도 이어서 진행할 수 있도록 모든 결정사항과 진행 현황을 이 섹션에 기록합니다.

### 결정 완료 사항
| 날짜 | 항목 | 결정 내용 |
|------|------|-----------|
| 2026-05-05 | 프로젝트명 | Ecclesia (고대 헬라어 "회의") |
| 2026-05-05 | 아키텍처 | Agent Harness 시스템 |
| 2026-05-05 | 팀 수 | 제한 없음 (유동적) |
| 2026-05-05 | 회의록 양식 | 다중 템플릿 지원, default: 회의록_DX정기미팅0430.docx |
| 2026-05-05 | STT 서비스 | Groq Whisper API (무료, whisper-large-v3-turbo) |
| 2026-05-05 | 화자 분리 | pyannote-audio (로컬, 무료) |
| 2026-05-05 | LLM | Claude API (claude-sonnet-4-6) |
| 2026-05-05 | 배포 환경 | 로컬 전용 (우선) |
| 2026-05-05 | 언어 | 한국어 전용 |
| 2026-05-05 | 녹음 파일 | 1개 이상, 각 파일 독립 처리 |
| 2026-05-05 | 회의록 원칙 | Fact-Only (추측·예상 내용 생성 금지) |

### 개발 진행 현황
| Phase | 상태 | 완료일 | 비고 |
|-------|------|--------|------|
| 기획 | ✅ 완료 | 2026-05-05 | PLAN.md 작성 완료 |
| Phase 1 | ✅ 완료 | 2026-05-05 | 프로젝트 뼈대 — 백엔드 + 프론트엔드 기동 확인 |
| Phase 2 | ⬜ 대기 | - | STT 파이프라인 (다음 작업) |
| Phase 3 | ⬜ 대기 | - | Agent Harness |
| Phase 4 | ⬜ 대기 | - | 회의록 생성 |
| Phase 5 | ⬜ 대기 | - | Word 출력 + 검토 UI |

### Phase 1 구현 상세 (완료)

#### 실제 폴더 구조 (PLAN 대비 변경사항 포함)
```
ecclesia/
├── PLAN.md
├── backend/
│   ├── main.py              FastAPI 앱 + CORS + 라우터 등록
│   ├── database.py          SQLAlchemy SQLite 설정 (ecclesia.db 자동 생성)
│   ├── models.py            DB 모델 (Team, Template, Meeting, MeetingFile, MeetingMinutes, ActionItem)
│   ├── schemas.py           Pydantic 스키마
│   ├── api/
│   │   ├── __init__.py
│   │   ├── teams.py         팀 CRUD 5개 엔드포인트
│   │   ├── meetings.py      회의 CRUD 5개 엔드포인트 (team_id/status 필터)
│   │   └── templates.py     양식 업로드/기본값/삭제
│   ├── templates/           업로드된 .docx 파일 저장
│   ├── uploads/             음성 파일 저장 예정 (Phase 2)
│   ├── outputs/             생성 Word 파일 저장 예정 (Phase 5)
│   └── requirements.txt
│
└── frontend/                ※ src/ 없음 — app/이 루트에 바로 위치
    ├── app/
    │   ├── layout.tsx        사이드바 네비게이션 ("use client")
    │   ├── page.tsx          / → /dashboard 리다이렉트
    │   ├── globals.css
    │   ├── dashboard/page.tsx
    │   ├── meetings/
    │   │   ├── page.tsx
    │   │   ├── new/page.tsx
    │   │   └── [id]/page.tsx
    │   ├── teams/page.tsx
    │   └── templates/page.tsx
    ├── lib/
    │   └── api.ts            fetch 유틸 + TypeScript 타입 정의
    ├── next.config.ts        /api/* → localhost:8000 proxy
    └── package.json
```

#### 설치된 Python 패키지 (pip)
- fastapi 0.128, uvicorn 0.40, pydantic 2.12.5
- sqlalchemy 2.0.49, aiofiles 25.1.0
- python-multipart (버전 무관), python-docx 1.2.0

#### 서버 실행 방법
```bash
# 백엔드 (포트 8000)
cd E:/ryan_project/jobible_ecclesia/backend
uvicorn main:app --reload

# 프론트엔드 (포트 3000)
cd E:/ryan_project/jobible_ecclesia/frontend
npm run dev
```

#### 접속 URL
- 프론트엔드: http://localhost:3000
- Swagger UI: http://localhost:8000/docs
- Health check: http://localhost:8000/health

### Phase 2 작업 계획 (다음 단계)

**목표**: 회의 상세 페이지에서 음성 파일 업로드 → Groq Whisper STT 처리

**세부 작업**
1. `backend/api/meetings.py` — 파일 업로드 엔드포인트 추가 (`POST /api/meetings/{id}/files`)
2. `backend/agents/stt_agent.py` — Groq Whisper API 호출 (whisper-large-v3-turbo)
3. STT 처리 상태 비동기 업데이트 (BackgroundTasks 활용)
4. `frontend/app/meetings/[id]/page.tsx` — 파일 업로드 UI + STT 진행 상태 표시

**필요한 추가 설치**
- `pip install groq` (Groq Python SDK)
- Groq API Key 필요 (https://console.groq.com)

### 미결 사항
- Groq API Key 미입력 (Phase 2 시작 전 준비 필요)
- UI/UX 디자인 개선은 메인 기능 완성 후 별도 진행 예정

### 주요 파일 경로 참고
| 항목 | 경로 |
|------|------|
| 기획서 | `E:\ryan_project\jobible_ecclesia\PLAN.md` |
| 기본 회의록 양식 | `D:\Chrome Download\회의록_DX정기미팅0430.docx` |
| 작업 디렉토리 | `E:\ryan_project\jobible_ecclesia\` |
| SQLite DB | `E:\ryan_project\jobible_ecclesia\backend\ecclesia.db` |

---

*최초 작성: 2026-05-05*
*최종 수정: 2026-05-05 (Phase 1 완료)*
*프로젝트: Ecclesia v1.0*
