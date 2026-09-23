import logging
import os
import time

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

import engine  # noqa: E402
import engine_fallback as fallback  # noqa: E402
import storage  # noqa: E402
from concepts import PRESET_TOPICS  # noqa: E402

log = logging.getLogger("teachbot")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Teachable AI Bot API")

origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

storage.init_db()


class StartSession(BaseModel):
    topic_id: str


class CustomTopic(BaseModel):
    topic: str


class TeachMsg(BaseModel):
    session_id: str
    message: str


class SessionRef(BaseModel):
    session_id: str


def _call(name, *args):
    """Try main engine (1 retry), else fallback. Returns (result, used_fallback)."""
    if os.getenv("FORCE_FALLBACK") == "1":
        return getattr(fallback, name)(*args), True
    for attempt in range(2):
        try:
            return getattr(engine, name)(*args), False
        except Exception as e:
            log.warning("engine.%s failed (attempt %d): %s", name, attempt + 1, e)
            if attempt == 0:
                time.sleep(1)
    try:
        return getattr(fallback, name)(*args), True
    except Exception as e:
        log.error("fallback.%s failed: %s", name, e)
        raise HTTPException(503, "Bot is busy. Please retry.")


def _load(sid):
    data = storage.get_session(sid)
    if not data:
        raise HTTPException(404, "Session not found")
    return data


def _public_map(data):
    return [
        {"id": c["id"], "name": c["name"], "status": data["state"][c["id"]]}
        for c in data["concepts"]
    ]


@app.get("/health")
def health():
    return {"status": "ok", "force_fallback": os.getenv("FORCE_FALLBACK") == "1"}


@app.get("/api/topics")
def topics():
    return [
        {"id": k, "title": v["title"], "concept_count": len(v["concepts"])}
        for k, v in PRESET_TOPICS.items()
    ]


@app.post("/api/session")
def start_session(body: StartSession):
    topic = PRESET_TOPICS.get(body.topic_id)
    if not topic:
        raise HTTPException(404, "Unknown topic")
    sid, data = storage.create_session(topic["title"], topic["concepts"])
    return {"session_id": sid, "topic": data["topic"], "knowledge_map": _public_map(data)}


@app.post("/api/session/custom")
def start_custom(body: CustomTopic):
    title = body.topic.strip()
    if not title:
        raise HTTPException(400, "Topic is empty")
    concepts, used_fb = _call("generate_concepts", title)
    sid, data = storage.create_session(title, concepts)
    return {
        "session_id": sid,
        "topic": data["topic"],
        "knowledge_map": _public_map(data),
        "fallback": used_fb,
    }


@app.post("/api/teach")
def teach(body: TeachMsg):
    data = _load(body.session_id)
    msg = body.message.strip()
    if not msg:
        raise HTTPException(400, "Message is empty")
    result, used_fb = _call(
        "process_teaching",
        data["topic"], data["concepts"], data["state"], data["messages"], msg,
    )
    data["state"] = result["state"]
    data["messages"].append({"role": "student", "text": msg})
    data["messages"].append({"role": "bot", "text": result["bot_reply"]})
    storage.save_session(body.session_id, data)
    return {
        "bot_reply": result["bot_reply"],
        "knowledge_map": _public_map(data),
        "fallback": used_fb,
    }


@app.post("/api/quiz")
def quiz(body: SessionRef):
    data = _load(body.session_id)
    questions, used_fb = _call("run_quiz", data["topic"], data["concepts"], data["state"], data["messages"])
    correct = sum(1 for q in questions if q["correct"])
    return {
        "questions": questions,
        "correct": correct,
        "total": len(questions),
        "fallback": used_fb,
    }


@app.post("/api/report")
def report(body: SessionRef):
    data = _load(body.session_id)
    rep, used_fb = _call(
        "score_teaching",
        data["topic"], data["concepts"], data["state"], data["messages"],
    )
    return {**rep, "knowledge_map": _public_map(data), "fallback": used_fb}


@app.get("/api/session/{session_id}")
def get_session(session_id: str):
    data = _load(session_id)
    return {
        "session_id": session_id,
        "topic": data["topic"],
        "messages": data["messages"],
        "knowledge_map": _public_map(data),
    }


@app.get("/api/history")
def history():
    return storage.list_sessions()