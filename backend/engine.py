import os
import json
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

# client = Groq(api_key=os.getenv("GROQ_API_KEY"))
# MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
client = Groq(api_key=os.getenv("LLM_API_KEY"))
MODEL = os.getenv("LLM_MODEL", "openai/gpt-oss-120b")


def _chat(prompt, max_tokens=800):
    response = client.chat.completions.create(
        model=MODEL,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content.strip()


def _clean_json(text):
    text = text.replace("```json", "").replace("```", "").strip()
    if not text:
        raise ValueError("Empty response from model")
    return json.loads(text)


def generate_concepts(topic: str) -> list:
    prompt = f"""List 4 to 6 key concepts a student should teach an AI about "{topic}" to demonstrate understanding.

Respond ONLY with valid JSON, no other text:
{{
  "concepts": [
    {{"id": "c1", "name": "concept name"}}
  ]
}}
"""
    result = _clean_json(_chat(prompt, max_tokens=800))
    return [{"id": c["id"], "name": c["name"], "keywords": []} for c in result["concepts"]]


def process_teaching(topic, concepts, state, history, message) -> dict:
    concepts_list = "\n".join(
        [f"- {c['id']}: {c['name']} (current status: {state.get(c['id'], 'unknown')})" for c in concepts]
    )

    prompt = f"""You are grading a student's explanation to update an AI's knowledge state about "{topic}".

Concepts and current status:
{concepts_list}

Student just said:
\"\"\"{message}\"\"\"

For each concept, decide its NEW status based on this message:
- "correct": explained accurately and clearly
- "partial": mentioned but incomplete or vague
- "misconception": explained incorrectly
- "unknown": not mentioned in this message (keep previous status if already known)

Rules:
- If a concept is not mentioned in this message, KEEP its current status unchanged.
- Only change status for concepts actually addressed in this message.

Respond ONLY with valid JSON, no other text:
{{
  "updates": [
    {{"id": "c1", "status": "correct"}}
  ]
}}
"""
    result = _clean_json(_chat(prompt, max_tokens=800))

    new_state = dict(state)
    for item in result.get("updates", []):
        cid = item["id"]
        if cid in new_state:
            new_state[cid] = item["status"]

    pending = [c for c in concepts if new_state.get(c["id"]) in ("unknown", "partial")]

    if pending:
        target = pending[0]
        followup_prompt = f"""You are an AI acting like a curious student learning about "{topic}".
You are weakest on: "{target['name']}" (status: {new_state.get(target['id'])}).
Ask ONE short, natural follow-up question about it.
Respond with ONLY the question text, nothing else.
"""
        bot_reply = _chat(followup_prompt, max_tokens=200)
    else:
        bot_reply = "I think I understand everything now. Ready to quiz me?"

    return {"state": new_state, "bot_reply": bot_reply}


def _taught_text(history):
    return " ".join(m["text"] for m in (history or []) if m.get("role") == "student")


def run_quiz(topic, concepts, state, history=None) -> list:
    taught_text = _taught_text(history)
    concepts_list = "\n".join([f"- {c['id']}: {c['name']}" for c in concepts])

    q_prompt = f"""Create one short quiz question for EACH of these concepts about "{topic}":
{concepts_list}

Respond ONLY with valid JSON, no other text:
{{
  "questions": [
    {{"id": "c1", "question": "question text"}}
  ]
}}
"""
    result = _clean_json(_chat(q_prompt, max_tokens=1500))
    q_map = {q["id"]: q["question"] for q in result["questions"]}

    out = []
    for c in concepts:
        cid = c["id"]
        status = state.get(cid, "unknown")
        question = q_map.get(cid, f"Explain {c['name']}.")

        if status == "unknown":
            bot_answer = "I was never taught this, so I don't know."
        else:
            answer_prompt = f"""You are an AI student who ONLY knows what you were explicitly taught. Answer based ONLY on this.

What you were taught (may include mistakes):
\"\"\"{taught_text}\"\"\"

Your understanding status of "{c['name']}": {status}

Quiz question: {question}

STRICT RULES:
- If status is "misconception", confidently answer USING the wrong idea you were taught. Do NOT say you don't know. Do NOT self-correct.
- If status is "correct", answer accurately based on what was taught.
- If status is "partial", give an incomplete/uncertain answer.

Respond with ONLY your final answer, 2-3 sentences max.
"""
            bot_answer = _chat(answer_prompt, max_tokens=400)

        out.append({
            "concept_id": cid,
            "question": question,
            "bot_answer": bot_answer,
            "correct": status == "correct",
        })

    return out


def score_teaching(topic, concepts, state, history) -> dict:
    well_taught = [c["name"] for c in concepts if state.get(c["id"]) == "correct"]
    vague = [c["name"] for c in concepts if state.get(c["id"]) == "partial"]
    misconceptions = [c["name"] for c in concepts if state.get(c["id"]) == "misconception"]

    total = len(concepts) or 1
    score = int((len(well_taught) / total) * 100)

    feedback_prompt = f"""A student taught an AI about "{topic}".

Well taught: {well_taught}
Vague: {vague}
Misconceptions: {misconceptions}
Score: {score}/100

Write a short, encouraging 2-3 sentence feedback mentioning what to improve.
"""
    feedback = _chat(feedback_prompt, max_tokens=400)

    return {
        "score": score,
        "feedback": feedback,
        "strengths": well_taught,
        "gaps": vague + misconceptions,
    }