from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pandas as pd

from domain.rules import enrich_fluid_row, enrich_injection_row
from services.llm_client import LLMNotConfiguredError, call_parse_llm


def _empty_result() -> dict[str, Any]:
    return {"fluids": [], "injections": [], "ignored_lines": []}


def parse_order_text(raw_text: str, *, use_llm: bool = True) -> dict[str, Any]:
    raw_text = (raw_text or "").strip()
    if not raw_text:
        return _empty_result()

    if not use_llm:
        return _empty_result()

    try:
        data = call_parse_llm(raw_text)
    except LLMNotConfiguredError:
        raise
    except Exception as e:
        return {
            **_empty_result(),
            "error": str(e),
        }

    fluids = []
    for row in data.get("fluids") or []:
        if isinstance(row, dict):
            fluids.append(enrich_fluid_row(row))

    injections = []
    for row in data.get("injections") or []:
        if isinstance(row, dict):
            injections.append(enrich_injection_row(row))

    return {
        "fluids": fluids,
        "injections": injections,
        "ignored_lines": list(data.get("ignored_lines") or []),
        "parsed_at": datetime.now(timezone.utc).isoformat(),
    }


def fluids_to_dataframe(fluids: list[dict[str, Any]]) -> pd.DataFrame:
    cols = ["service_date", "item_name", "quantity", "unit", "status", "source_line"]
    if not fluids:
        return pd.DataFrame(columns=cols)
    df = pd.DataFrame(fluids)
    for c in cols:
        if c not in df.columns:
            df[c] = None
    return df[cols]


def injections_to_dataframe(injections: list[dict[str, Any]]) -> pd.DataFrame:
    cols = [
        "service_date",
        "patient_name",
        "equipment",
        "chart_no",
        "room_no",
        "detail",
        "incentive_amount",
        "status",
    ]
    if not injections:
        return pd.DataFrame(columns=cols)
    df = pd.DataFrame(injections)
    for c in cols:
        if c not in df.columns:
            df[c] = None
    return df[cols]


def dataframe_to_fluids(df: pd.DataFrame) -> list[dict[str, Any]]:
    records = []
    for _, row in df.iterrows():
        records.append(
            enrich_fluid_row(
                {
                    "service_date": row.get("service_date"),
                    "item_name": row.get("item_name"),
                    "quantity": row.get("quantity"),
                    "unit": row.get("unit"),
                    "status": row.get("status"),
                    "source_line": row.get("source_line"),
                }
            )
        )
    return records


def dataframe_to_injections(df: pd.DataFrame) -> list[dict[str, Any]]:
    records = []
    for _, row in df.iterrows():
        base = enrich_injection_row(
            {
                "service_date": row.get("service_date"),
                "patient_name": row.get("patient_name"),
                "equipment": row.get("equipment"),
                "chart_no": row.get("chart_no"),
                "room_no": row.get("room_no"),
                "detail": row.get("detail"),
                "status": row.get("status"),
            }
        )
        # 사용자가 금액을 직접 수정했을 수 있음
        try:
            amt = row.get("incentive_amount")
            if amt is not None and str(amt).strip() != "":
                base["incentive_amount"] = int(float(amt))
        except (TypeError, ValueError):
            pass
        records.append(base)
    return records
