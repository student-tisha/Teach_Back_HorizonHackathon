import json
import os
import sqlite3
import time
import uuid

DB_PATH = os.getenv("DB_PATH", "teachbot.db")


def _conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with _conn() as c:
        c.execute(
            """CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                topic TEXT NOT NULL,
                data TEXT NOT NULL,
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL
            )"""
        )


def create_session(topic_title, concepts):
    sid = uuid.uuid4().hex[:12]
    now = time.time()
    data = {
        "topic": topic_title,
        "concepts": concepts,
        "state": {c["id"]: "unknown" for c in concepts},
        "messages": [],
    }
    with _conn() as c:
        c.execute(
            "INSERT INTO sessions (id, topic, data, created_at, updated_at) VALUES (?,?,?,?,?)",
            (sid, topic_title, json.dumps(data), now, now),
        )
    return sid, data


def get_session(sid):
    with _conn() as c:
        row = c.execute("SELECT data FROM sessions WHERE id=?", (sid,)).fetchone()
    return json.loads(row["data"]) if row else None


def save_session(sid, data):
    with _conn() as c:
        c.execute(
            "UPDATE sessions SET data=?, updated_at=? WHERE id=?",
            (json.dumps(data), time.time(), sid),
        )


def list_sessions():
    with _conn() as c:
        rows = c.execute(
            "SELECT id, topic, data, created_at, updated_at FROM sessions ORDER BY updated_at DESC LIMIT 50"
        ).fetchall()
    out = []
    for r in rows:
        d = json.loads(r["data"])
        total = len(d["state"]) or 1
        correct = sum(1 for v in d["state"].values() if v == "correct")
        out.append(
            {
                "session_id": r["id"],
                "topic": r["topic"],
                "created_at": r["created_at"],
                "updated_at": r["updated_at"],
                "messages": len(d["messages"]),
                "progress_pct": round(correct * 100 / total),
            }
        )
    return out