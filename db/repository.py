from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd

from config.settings import DATABASE_PATH, DEFAULT_SAFETY_STOCK
from db.schema import init_db


def _conn() -> sqlite3.Connection:
    init_db(DATABASE_PATH)
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def save_approved_batch(
    raw_text: str,
    fluids: list[dict[str, Any]],
    injections: list[dict[str, Any]],
) -> int:
    now = datetime.now(timezone.utc).isoformat()
    preview = (raw_text or "")[:500]
    with _conn() as conn:
        cur = conn.execute(
            "INSERT INTO parse_batches (created_at, raw_text_preview) VALUES (?, ?)",
            (now, preview),
        )
        batch_id = int(cur.lastrowid)

        for f in fluids:
            if (f.get("status") or "approved") == "pending":
                continue
            conn.execute(
                """
                INSERT INTO fluid_usage
                (batch_id, service_date, item_name, quantity, unit, status, source_line, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    batch_id,
                    f.get("service_date"),
                    f.get("item_name"),
                    float(f.get("quantity") or 0),
                    f.get("unit"),
                    f.get("status") or "approved",
                    f.get("source_line"),
                    now,
                ),
            )

        for inj in injections:
            if (inj.get("status") or "approved") == "pending":
                continue
            conn.execute(
                """
                INSERT INTO injection_records
                (batch_id, service_date, patient_name, equipment, chart_no, room_no,
                 detail, incentive_amount, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    batch_id,
                    inj.get("service_date"),
                    inj.get("patient_name"),
                    inj.get("equipment"),
                    inj.get("chart_no"),
                    inj.get("room_no"),
                    inj.get("detail"),
                    int(inj.get("incentive_amount") or 0),
                    inj.get("status") or "approved",
                    now,
                ),
            )
        conn.commit()
        return batch_id


def fetch_injections(
    date_from: str | None = None,
    date_to: str | None = None,
) -> pd.DataFrame:
    q = """
        SELECT id, service_date, patient_name, equipment, chart_no, room_no,
               detail, incentive_amount, status, created_at
        FROM injection_records
        WHERE status != 'pending'
    """
    params: list[Any] = []
    if date_from:
        q += " AND (service_date IS NULL OR service_date >= ?)"
        params.append(date_from)
    if date_to:
        q += " AND (service_date IS NULL OR service_date <= ?)"
        params.append(date_to)
    q += " ORDER BY service_date DESC, id DESC"
    with _conn() as conn:
        return pd.read_sql_query(q, conn, params=params)


def incentive_summary_by_room(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame(
            columns=["room_no", "procedure_count", "total_incentive", "S_count", "C_count"]
        )
    work = df.copy()
    work["room_no"] = pd.to_numeric(work["room_no"], errors="coerce")
    rows = []
    for room in sorted(work["room_no"].dropna().unique()):
        sub = work[work["room_no"] == room]
        rows.append(
            {
                "room_no": int(room),
                "procedure_count": len(sub),
                "total_incentive": int(sub["incentive_amount"].sum()),
                "S_count": int((sub["equipment"] == "S").sum()),
                "C_count": int((sub["equipment"] == "C").sum()),
            }
        )
    return pd.DataFrame(rows)


def fetch_fluid_usage(
    date_from: str | None = None,
    date_to: str | None = None,
) -> pd.DataFrame:
    q = """
        SELECT service_date, item_name, SUM(quantity) AS total_qty, unit
        FROM fluid_usage
        WHERE status != 'pending'
    """
    params: list[Any] = []
    if date_from:
        q += " AND (service_date IS NULL OR service_date >= ?)"
        params.append(date_from)
    if date_to:
        q += " AND (service_date IS NULL OR service_date <= ?)"
        params.append(date_to)
    q += " GROUP BY item_name, unit ORDER BY item_name"
    with _conn() as conn:
        return pd.read_sql_query(q, conn, params=params)


def get_safety_stock() -> dict[str, float]:
    with _conn() as conn:
        rows = conn.execute("SELECT item_name, min_quantity FROM safety_stock").fetchall()
    if not rows:
        for name, qty in DEFAULT_SAFETY_STOCK.items():
            upsert_safety_stock(name, qty)
        return dict(DEFAULT_SAFETY_STOCK)
    return {r["item_name"]: float(r["min_quantity"]) for r in rows}


def upsert_safety_stock(item_name: str, min_quantity: float) -> None:
    with _conn() as conn:
        conn.execute(
            """
            INSERT INTO safety_stock (item_name, min_quantity) VALUES (?, ?)
            ON CONFLICT(item_name) DO UPDATE SET min_quantity = excluded.min_quantity
            """,
            (item_name, min_quantity),
        )
        conn.commit()


def reorder_candidates(usage_df: pd.DataFrame, safety: dict[str, float]) -> pd.DataFrame:
    """기간 사용량 vs 안전재고 — 부족 품목."""
    if usage_df.empty and not safety:
        return pd.DataFrame(columns=["item_name", "period_usage", "min_quantity", "shortage"])

    usage_map: dict[str, float] = {}
    if not usage_df.empty:
        for _, r in usage_df.iterrows():
            usage_map[str(r["item_name"])] = float(r["total_qty"])

    all_items = set(safety.keys()) | set(usage_map.keys())
    rows = []
    for item in sorted(all_items):
        used = usage_map.get(item, 0.0)
        min_q = safety.get(item, 0.0)
        # MVP: 기간 소모가 안전재고 기준을 넘었거나, 잔여 개념 없이 min 대비 used >= min 이면 발주 검토
        if used >= min_q and min_q > 0:
            rows.append(
                {
                    "item_name": item,
                    "period_usage": used,
                    "min_quantity": min_q,
                    "shortage": max(0.0, used - min_q),
                    "note": "기간 사용량이 안전재고 기준 이상 — 발주 검토",
                }
            )
    return pd.DataFrame(rows)
