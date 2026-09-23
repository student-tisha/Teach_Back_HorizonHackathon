import json
import sys
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000").rstrip("/")


def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        BASE + path,
        data=data,
        method=method,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.loads(r.read())


def check(name, fn):
    try:
        out = fn()
        print("PASS", name)
        return out
    except Exception as e:
        print("FAIL", name, "->", e)
        return None


def valid_map(m):
    ok = {"unknown", "partial", "correct", "misconception"}
    assert m and all(x["status"] in ok for x in m), "bad knowledge_map"


print("Testing", BASE)
check("health", lambda: call("GET", "/health"))
check("topics", lambda: call("GET", "/api/topics"))

s = check(
    "start session",
    lambda: call("POST", "/api/session", {"topic_id": "photosynthesis"}),
)
if s:
    sid = s["session_id"]

    def teach():
        r = call(
            "POST",
            "/api/teach",
            {"session_id": sid, "message": "Plants use sunlight and chlorophyll to make glucose"},
        )
        assert r["bot_reply"], "empty bot_reply"
        valid_map(r["knowledge_map"])
        print("   bot:", r["bot_reply"], "| fallback:", r.get("fallback"))
        return r

    check("teach", teach)

    def quiz():
        r = call("POST", "/api/quiz", {"session_id": sid})
        assert r["questions"], "no questions"
        print("   score:", r["correct"], "/", r["total"], "| fallback:", r.get("fallback"))
        return r

    check("quiz", quiz)

    def report():
        r = call("POST", "/api/report", {"session_id": sid})
        assert "score" in r, "no score"
        print("   score:", r["score"], "| fallback:", r.get("fallback"))
        return r

    check("report", report)
    check("get session", lambda: call("GET", "/api/session/" + sid))

check("history", lambda: call("GET", "/api/history"))

c = check(
    "custom topic",
    lambda: call("POST", "/api/session/custom", {"topic": "Black holes"}),
)
if c:
    valid_map(c["knowledge_map"])
    print("   fallback:", c.get("fallback"))

print("Done")