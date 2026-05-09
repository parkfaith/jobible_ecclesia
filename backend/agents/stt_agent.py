import os
from pathlib import Path


WHISPER_MODEL = "whisper-large-v3-turbo"
BACKEND_DIR = Path(__file__).resolve().parent.parent


try:
    from dotenv import load_dotenv

    load_dotenv(BACKEND_DIR / ".env", override=True)
except ImportError:
    pass


def _read_groq_key_from_env_file() -> str:
    env_path = BACKEND_DIR / ".env"
    if not env_path.exists():
        return ""
    for line in env_path.read_text(encoding="utf-8-sig").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        if key.strip() == "GROQ_API_KEY":
            return value.strip().strip("\"'")
    return ""


def transcribe_audio(audio_path: str) -> str:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        api_key = _read_groq_key_from_env_file()
        if api_key:
            os.environ["GROQ_API_KEY"] = api_key
    if not api_key:
        raise RuntimeError("GROQ_API_KEY가 설정되어 있지 않습니다.")

    try:
        from groq import Groq
    except ImportError as exc:
        raise RuntimeError("groq 패키지가 설치되어 있지 않습니다. `pip install groq`를 실행하세요.") from exc

    path = Path(audio_path)
    if not path.exists():
        raise RuntimeError("음성 파일을 찾을 수 없습니다.")

    client = Groq(api_key=api_key)
    with path.open("rb") as audio_file:
        result = client.audio.transcriptions.create(
            file=(path.name, audio_file.read()),
            model=WHISPER_MODEL,
            language="ko",
            response_format="json",
        )

    text = getattr(result, "text", None)
    if not text and isinstance(result, dict):
        text = result.get("text")
    if not text:
        raise RuntimeError("STT 결과 텍스트가 비어 있습니다.")
    return text.strip()
