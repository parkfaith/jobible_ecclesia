import json
from typing import Any


def build_minutes_input(meeting: Any, transcript: Any) -> dict:
    attendees = []
    try:
        attendees = json.loads(meeting.attendees or "[]")
    except json.JSONDecodeError:
        attendees = []

    return {
        "meeting": {
            "id": meeting.id,
            "title": meeting.title,
            "date": meeting.date,
            "team": meeting.team.name if meeting.team else "",
            "attendees": attendees,
        },
        "transcript": {
            "status": transcript.status,
            "source_file_count": transcript.source_file_count,
            "content_text": transcript.content_text,
            "content_json": json.loads(transcript.content_json or "{}"),
        },
        "rules": {
            "fact_only": True,
            "do_not_infer_unspoken_content": True,
            "mark_unclear_content": True,
        },
    }


def generate_minutes_draft(minutes_input: dict) -> dict:
    meeting = minutes_input["meeting"]
    transcript = minutes_input["transcript"]
    content_text = transcript["content_text"].strip()

    if not content_text:
        raise ValueError("통합 transcript가 비어 있습니다.")

    return {
        "status": "draft",
        "source": "local_placeholder",
        "meeting": meeting,
        "summary": "[Claude 연동 전 임시 초안] 통합 transcript를 기반으로 회의록 초안 생성 입력이 준비되었습니다.",
        "sections": [
            {
                "title": "원문 기반 회의 내용",
                "items": [content_text],
            }
        ],
        "action_items": [],
        "unclear_items": [],
        "generation_notes": [
            "현재 초안은 Claude API 연동 전 로컬 placeholder입니다.",
            "발화되지 않은 내용은 추가하지 않았습니다.",
            "다음 단계에서 이 입력 구조를 Claude fact-only 프롬프트에 전달합니다.",
        ],
    }
