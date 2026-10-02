from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
DEFAULT_DB = DATA_DIR / "orders.db"

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o").strip()
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "").strip()
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514").strip()
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "").strip().lower()

_db_path = os.getenv("DATABASE_PATH", "").strip()
DATABASE_PATH = Path(_db_path) if _db_path else DEFAULT_DB

# 인센티브 단가 (원)
INCENTIVE_SONO = 10_000
INCENTIVE_CARM = 20_000

# 기본 안전 재고 (Tab3 — UI에서도 수정 가능)
DEFAULT_SAFETY_STOCK: dict[str, float] = {
    "PRF": 20,
    "AAP2": 30,
    "+V": 30,
    "백옥600": 10,
    "백옥1200": 10,
    "신데렐라": 10,
    "글루타치온600": 10,
    "글루타치온1200": 10,
    "네포팜": 10,
    "메박신": 10,
    "라이넥": 10,
    "이부프로펜": 10,
    "케톨락": 10,
    "엔에이씨": 10,
}


def resolve_llm_provider() -> str | None:
    if LLM_PROVIDER in ("openai", "anthropic"):
        if LLM_PROVIDER == "openai" and OPENAI_API_KEY:
            return "openai"
        if LLM_PROVIDER == "anthropic" and ANTHROPIC_API_KEY:
            return "anthropic"
        return None
    if OPENAI_API_KEY:
        return "openai"
    if ANTHROPIC_API_KEY:
        return "anthropic"
    return None
