from __future__ import annotations

import sqlite3
from pathlib import Path

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS parse_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    raw_text_preview TEXT
);

CREATE TABLE IF NOT EXISTS fluid_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER,
    service_date TEXT,
    item_name TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 0,
    unit TEXT,
    status TEXT NOT NULL DEFAULT 'approved',
    source_line TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (batch_id) REFERENCES parse_batches(id)
);

CREATE TABLE IF NOT EXISTS injection_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER,
    service_date TEXT,
    patient_name TEXT,
    equipment TEXT,
    chart_no TEXT,
    room_no INTEGER,
    detail TEXT,
    incentive_amount INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'approved',
    created_at TEXT NOT NULL,
    FOREIGN KEY (batch_id) REFERENCES parse_batches(id)
);

CREATE TABLE IF NOT EXISTS safety_stock (
    item_name TEXT PRIMARY KEY,
    min_quantity REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_fluid_date ON fluid_usage(service_date);
CREATE INDEX IF NOT EXISTS idx_fluid_item ON fluid_usage(item_name);
CREATE INDEX IF NOT EXISTS idx_injection_date ON injection_records(service_date);
CREATE INDEX IF NOT EXISTS idx_injection_room ON injection_records(room_no);
"""


def init_db(db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(db_path) as conn:
        conn.executescript(SCHEMA_SQL)
        conn.commit()
