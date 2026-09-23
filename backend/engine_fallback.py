def generate_concepts(topic: str) -> list:
    base = topic.strip() or "Topic"
    names = [
        f"What is {base}",
        f"Key terms of {base}",
        f"How {base} works",
        f"Examples of {base}",
        f"Why {base} matters",
    ]
    return [
        {"id": f"c{i+1}", "name": n, "keywords": [n.lower()]}
        for i, n in enumerate(names)
    ]


def process_teaching(topic, concepts, state, history, message) -> dict:
    text = message.lower()
    new_state = dict(state)
    for c in concepts:
        if any(k in text for k in c.get("keywords", [])):
            new_state[c["id"]] = "partial" if state.get(c["id"]) == "unknown" else "correct"
    pending = [c for c in concepts if new_state[c["id"]] in ("unknown", "partial")]
    if pending:
        reply = f"Interesting! Can you explain more about {pending[0]['name']}? I don't get it yet."
    else:
        reply = "I think I understand everything now. Ready to quiz me?"
    return {"state": new_state, "bot_reply": reply}


def run_quiz(topic, concepts, state) -> list:
    out = []
    for c in concepts:
        ok = state.get(c["id"]) == "correct"
        out.append(
            {
                "concept_id": c["id"],
                "question": f"Can you explain: {c['name']}?",
                "bot_answer": "Yes, you taught me this!" if ok else "Sorry, I was not taught this properly.",
                "correct": ok,
            }
        )
    return out


def score_teaching(topic, concepts, state, history) -> dict:
    n = len(concepts) or 1
    pts = sum(1.0 if v == "correct" else 0.5 if v == "partial" else 0 for v in state.values())
    score = round(pts * 100 / n)
    return {
        "score": score,
        "feedback": "Good effort! Cover the missing concepts to improve.",
        "strengths": [c["name"] for c in concepts if state.get(c["id"]) == "correct"],
        "gaps": [c["name"] for c in concepts if state.get(c["id"]) in ("unknown", "misconception")],
    }