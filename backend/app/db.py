"""Persistência em SQLite.

Numa máquina que a pessoa usa repetidamente, perder as transcrições no restart é
fricção desnecessária — a biblioteca reabre resultados antigos sem reprocessar.
"""
from __future__ import annotations

import json
import sqlite3
import threading
from pathlib import Path
from typing import Any

from . import config

_lock = threading.Lock()
_conn: sqlite3.Connection | None = None

SCHEMA = """
CREATE TABLE IF NOT EXISTS jobs (
    id           TEXT PRIMARY KEY,
    filename     TEXT NOT NULL,
    state        TEXT NOT NULL,
    stage        TEXT NOT NULL,
    progress     REAL NOT NULL DEFAULT 0,
    mode         TEXT NOT NULL,
    route        TEXT,
    device       TEXT,
    error        TEXT,
    created_at   REAL NOT NULL,
    duration     REAL,
    audio_path   TEXT,
    result_json  TEXT
);
CREATE INDEX IF NOT EXISTS jobs_created_at ON jobs (created_at DESC);
"""


def connect() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        config.ensure_dirs()
        _conn = sqlite3.connect(config.DB_PATH, check_same_thread=False)
        _conn.row_factory = sqlite3.Row
        _conn.executescript(SCHEMA)
        _conn.commit()
    return _conn


def insert(record: dict[str, Any]) -> None:
    columns = ", ".join(record)
    placeholders = ", ".join(f":{k}" for k in record)
    with _lock:
        conn = connect()
        conn.execute(f"INSERT INTO jobs ({columns}) VALUES ({placeholders})", record)
        conn.commit()


def update(job_id: str, **fields: Any) -> None:
    if not fields:
        return
    assignments = ", ".join(f"{k} = :{k}" for k in fields)
    with _lock:
        conn = connect()
        conn.execute(f"UPDATE jobs SET {assignments} WHERE id = :id", {**fields, "id": job_id})
        conn.commit()


def get(job_id: str) -> sqlite3.Row | None:
    with _lock:
        return connect().execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()


def list_recent(limit: int = 100) -> list[sqlite3.Row]:
    with _lock:
        return connect().execute(
            "SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()


def delete(job_id: str) -> None:
    with _lock:
        conn = connect()
        conn.execute("DELETE FROM jobs WHERE id = ?", (job_id,))
        conn.commit()


def result_of(job_id: str) -> dict | None:
    row = get(job_id)
    if row is None or row["result_json"] is None:
        return None
    return json.loads(row["result_json"])


def recover_interrupted() -> int:
    """Jobs que ficaram 'running' num restart nunca vão terminar — marca como erro."""
    with _lock:
        conn = connect()
        cursor = conn.execute(
            "UPDATE jobs SET state = 'error', error = ? WHERE state IN ('running','queued')",
            ("Interrompido por reinício do servidor.",),
        )
        conn.commit()
        return cursor.rowcount
