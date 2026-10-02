from __future__ import annotations

import re
from typing import Any

from config.settings import INCENTIVE_CARM, INCENTIVE_SONO

# 차트 번호 끝 -N → 진료실 N
CHART_ROOM_SUFFIX = re.compile(r"-(\d+)\s*$")

# 메모/날짜 없음 등 — pending 분류 힌트
MEMO_PATTERNS = re.compile(
    r"메모|나중에|오시면|해뒀|보류|pending|미정",
    re.IGNORECASE,
)


def normalize_equipment(raw: str) -> str:
    s = (raw or "").strip().upper()
    if s in ("S", "SONO", "소노"):
        return "S"
    if s in ("C", "C-ARM", "CARM", "씨암"):
        return "C"
    if s.startswith("S"):
        return "S"
    if s.startswith("C"):
        return "C"
    return s or ""


def incentive_amount(equipment: str) -> int:
    eq = normalize_equipment(equipment)
    if eq == "S":
        return INCENTIVE_SONO
    if eq == "C":
        return INCENTIVE_CARM
    return 0


def room_from_chart(chart_no: str) -> int | None:
    if not chart_no:
        return None
    m = CHART_ROOM_SUFFIX.search(str(chart_no).strip())
    if m:
        return int(m.group(1))
    # 중간에 -3 형태
    m2 = re.search(r"-(\d+)(?:\D|$)", str(chart_no))
    if m2:
        return int(m2.group(1))
    return None


def parse_quantity_multiplier(text: str) -> float:
    """원문에서 2@, 1/2, 0.5 등을 반영한 배율 (기본 1)."""
    if not text:
        return 1.0
    t = str(text)
    mult = 1.0
    at = re.search(r"(\d+)\s*@", t, re.IGNORECASE)
    if at:
        mult *= float(at.group(1))
    if re.search(r"(?<!\d)1\s*/\s*2(?!\d)", t) or re.search(r"\b0\.5\b", t):
        # 1/2 dose — LLM이 quantity에 반영해야 하나, 누락 시 보정용
        if "quantity_hint_half" not in t:
            pass  # quantity 필드에서 처리
    return mult


def apply_half_dose(quantity: float, source_line: str) -> float:
    line = source_line or ""
    if re.search(r"(?<!\d)1\s*/\s*2(?!\d)", line) or re.search(r"\b0\.5\b", line):
        if quantity >= 1 and quantity == int(quantity):
            return quantity * 0.5
    return quantity


def normalize_fluid_item_name(name: str) -> str:
    n = (name or "").strip()
    aliases = {
        "prf30": "PRF",
        "prf 30": "PRF",
        "prf30cc": "PRF",
        "prf 30cc": "PRF",
        "aap2": "AAP2",
        "+v": "+V",
        "백옥 600": "백옥600",
        "백옥 1200": "백옥1200",
        "글루600": "글루타치온600",
        "글루1200": "글루타치온1200",
        "nac": "엔에이씨",
        "엔에이씨": "엔에이씨",
    }
    key = n.lower().replace(" ", "")
    for k, v in aliases.items():
        if key == k.replace(" ", ""):
            return v
    return n


def fluid_unit_for_item(name: str) -> str:
    """PRF는 count(개), 나머지는 ampoule/vial 위주."""
    if normalize_fluid_item_name(name) == "PRF":
        return "count"
    return "ampoule"


def is_likely_pending_line(line: str) -> bool:
    line = (line or "").strip()
    if not line:
        return True
    if MEMO_PATTERNS.search(line):
        return True
    return False


def enrich_injection_row(row: dict[str, Any]) -> dict[str, Any]:
    chart = str(row.get("chart_no") or row.get("차트번호") or "")
    equip = normalize_equipment(str(row.get("equipment") or row.get("시술장비") or ""))
    room = row.get("room_no") or row.get("진료실")
    if room is None or room == "":
        room = room_from_chart(chart)
    amount = incentive_amount(equip)
    status = row.get("status") or "approved"
    if row.get("parse_status") == "pending":
        status = "pending"
    return {
        "patient_name": str(row.get("patient_name") or row.get("환자이름") or "").strip(),
        "equipment": equip,
        "chart_no": chart.strip(),
        "room_no": int(room) if room is not None and str(room).strip() != "" else None,
        "detail": str(row.get("detail") or row.get("시술상세") or "").strip(),
        "incentive_amount": amount,
        "status": status,
        "service_date": str(row.get("service_date") or row.get("날짜") or "").strip() or None,
    }


def enrich_fluid_row(row: dict[str, Any]) -> dict[str, Any]:
    name = normalize_fluid_item_name(str(row.get("item_name") or row.get("품목") or ""))
    qty = row.get("quantity") or row.get("수량") or 0
    try:
        qty_f = float(qty)
    except (TypeError, ValueError):
        qty_f = 0.0
    source = str(row.get("source_line") or row.get("원문") or "")
    qty_f = apply_half_dose(qty_f, source)
    mult = parse_quantity_multiplier(source)
    if mult != 1.0 and "@" in source:
        qty_f = max(qty_f, mult) if qty_f <= 1 else qty_f

    status = row.get("status") or "approved"
    if row.get("parse_status") == "pending" or is_likely_pending_line(source):
        status = "pending"

    return {
        "item_name": name,
        "quantity": qty_f,
        "unit": row.get("unit") or fluid_unit_for_item(name),
        "service_date": str(row.get("service_date") or row.get("날짜") or "").strip() or None,
        "source_line": source,
        "status": status,
    }
