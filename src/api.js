const USE_MOCK = false; // true = fake data, false = real API
const BASE_URL = "https://teach-back-horizonhackathon.onrender.com"; // no "/" at the end

const PATHS = {
  topics: "/api/topics",
  session: "/api/session",
  custom: "/api/session/custom",
  teach: "/api/teach",
  quiz: "/api/quiz",
  report: "/api/report",
};

const FALLBACK_TOPICS = ["Photosynthesis", "Newton's Laws", "Ohm's Law"];
const topicIds = {}; // display name -> topic_id
let lastConcepts = [];

/* ---------- helpers ---------- */
async function post(path, body) {
  const url = BASE_URL + path;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = "";
    try { detail = await res.text(); } catch (e) {}
    console.error("API FAILED:", res.status, "POST", url, body, detail);
    throw new Error("API error " + res.status);
  }
  const data = await res.json();
  console.log("API RESPONSE", path, data);
  return data;
}

function normConcepts(raw) {
  let list = raw;
  if (list && !Array.isArray(list) && typeof list === "object") {
    list = Object.entries(list).map(([k, v]) =>
      typeof v === "object" ? { name: k, ...v } : { name: k, status: v }
    );
  }
  if (!Array.isArray(list)) return lastConcepts;
  const out = list.map((c, i) => ({
    id: c.id ?? c.concept_id ?? c.name ?? "c" + i,
    name: c.name ?? c.label ?? c.concept ?? c.title ?? "Concept " + (i + 1),
    status: c.status ?? c.state ?? "unknown",
  }));
  lastConcepts = out;
  return out;
}

function getConcepts(res) {
  return normConcepts(
    res.concepts ?? res.knowledge_state ?? res.knowledge ?? res.concept_list ??
      res.knowledge_map ?? res.states
  );
}

function pickReply(res) {
  return (
    res.reply ?? res.bot_reply ?? res.bot_message ?? res.message ??
    res.question ?? res.follow_up ?? res.followup ?? res.response ??
    res.bot_question ?? "Tell me more!"
  );
}

/* ---------- TOPICS ---------- */
// -> string[] (display names)
export async function getTopics() {
  if (USE_MOCK) return Object.keys(MOCK_TOPICS);
  try {
    const res = await fetch(BASE_URL + PATHS.topics);
    if (!res.ok) throw new Error("no topics");
    const data = await res.json();
    console.log("API RESPONSE /api/topics", data);
    let arr = Array.isArray(data) ? data : data.topics ?? data.data ?? [];
    if (!Array.isArray(arr) && typeof arr === "object") {
      arr = Object.entries(arr).map(([id, v]) =>
        typeof v === "object" ? { id, ...v } : { id, name: v }
      );
    }
    const names = [];
    arr.forEach((t) => {
      if (typeof t === "string") {
        topicIds[t] = t;
        names.push(t);
      } else {
        const id = t.id ?? t.topic_id ?? t.slug ?? t.name;
        const name = t.name ?? t.title ?? t.label ?? String(id);
        topicIds[name] = id;
        names.push(name);
      }
    });
    return names.length ? names : FALLBACK_TOPICS;
  } catch (e) {
    console.warn("Topics API failed, using fallback list");
    return FALLBACK_TOPICS;
  }
}

/* ---------- SESSION ---------- */
// -> { session_id, reply, concepts:[{id,name,status}] }
export async function startSession(topic) {
  if (USE_MOCK) return mockStart(topic);
  const isPreset = Object.prototype.hasOwnProperty.call(topicIds, topic);
  const res = isPreset
    ? await post(PATHS.session, { topic_id: topicIds[topic] })
    : await post(PATHS.custom, { topic });
  return {
    session_id: res.session_id ?? res.id ?? res.session?.session_id ?? res.session?.id,
    reply: pickReply(res),
    concepts: getConcepts(res),
  };
}

/* ---------- TEACH ---------- */
// -> { reply, concepts }
export async function teach(session_id, message) {
  if (USE_MOCK) return mockTeach(session_id, message);
  const res = await post(PATHS.teach, { session_id, message });
  return { reply: pickReply(res), concepts: getConcepts(res) };
}

/* ---------- QUIZ ---------- */
// -> [{ id, concept, question, bot_answer, correct }]
export async function getQuiz(session_id) {
  if (USE_MOCK) return mockQuiz(session_id);
  const res = await post(PATHS.quiz, { session_id });
  const arr = Array.isArray(res) ? res : res.questions ?? res.quiz ?? res.results ?? [];
  return arr.map((q, i) => ({
    id: q.id ?? "q" + i,
    concept: q.concept ?? "",
    question: q.question ?? q.prompt ?? "Question " + (i + 1),
    bot_answer: q.bot_answer ?? q.answer ?? q.bot_response ?? "",
    correct: q.correct ?? q.is_correct ?? false,
  }));
}

/* ---------- REPORT ---------- */
// -> { score, strengths:[], gaps:[], tips:[] }
export async function getReport(session_id) {
  if (USE_MOCK) return mockReport(session_id);
  const res = await post(PATHS.report, { session_id });
  return {
    score: res.score ?? res.teaching_score ?? res.overall_score ?? res.teaching_quality ?? 0,
    strengths: res.strengths ?? [],
    gaps: res.gaps ?? res.weaknesses ?? res.misconceptions ?? [],
    tips: res.tips ?? res.suggestions ?? res.recommendations ?? [],
  };
}

/* ================= MOCK (fallback only) ================= */
const MOCK_TOPICS = {
  Photosynthesis: [
    { id: "light", name: "Light Reaction", keys: ["light reaction", "chlorophyll", "sunlight"] },
    { id: "calvin", name: "Calvin Cycle", keys: ["calvin", "dark reaction"] },
    { id: "co2", name: "CO2 Fixation", keys: ["co2", "carbon dioxide"] },
    { id: "glucose", name: "Glucose Production", keys: ["glucose", "sugar"] },
  ],
  "Newton's Laws": [
    { id: "n1", name: "First Law (Inertia)", keys: ["inertia", "first law"] },
    { id: "n2", name: "Second Law (F=ma)", keys: ["f=ma", "second law", "acceleration"] },
    { id: "n3", name: "Third Law", keys: ["third law", "equal and opposite", "reaction"] },
  ],
  "Ohm's Law": [
    { id: "v", name: "Voltage", keys: ["voltage", "potential"] },
    { id: "i", name: "Current", keys: ["current", "ampere"] },
    { id: "r", name: "Resistance", keys: ["resistance", "ohm"] },
    { id: "vir", name: "V = I x R", keys: ["v=ir", "v = i", "v=i*r"] },
  ],
};
const sessions = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function mockStart(topic) {
  await wait(300);
  const id = "s" + Date.now();
  const concepts = (MOCK_TOPICS[topic] || []).map((c) => ({ id: c.id, name: c.name, status: "unknown" }));
  sessions[id] = { topic, concepts };
  return {
    session_id: id,
    reply: `Hi! I'm your student. Teach me ${topic}. Where should we start?`,
    concepts,
  };
}

async function mockTeach(session_id, message) {
  await wait(600);
  const s = sessions[session_id];
  const text = message.toLowerCase();
  const defs = MOCK_TOPICS[s.topic];
  s.concepts = s.concepts.map((c) => {
    const def = defs.find((d) => d.id === c.id);
    const hit = def.keys.some((k) => text.includes(k));
    if (!hit || c.status === "correct") return c;
    return { ...c, status: message.length >= 40 ? "correct" : "partial" };
  });
  const next = s.concepts.find((c) => c.status !== "correct");
  const reply = next
    ? `Interesting! Can you explain "${next.name}" to me?`
    : "I think I understand everything now! Ready for my quiz?";
  return { reply, concepts: s.concepts };
}

async function mockQuiz(session_id) {
  await wait(500);
  return sessions[session_id].concepts.map((c) => ({
    id: c.id,
    concept: c.name,
    question: `What is ${c.name}?`,
    bot_answer:
      c.status === "correct"
        ? `You taught me: ${c.name} is an important part of this topic.`
        : c.status === "partial"
        ? "Hmm, I think it is something like that, but I am not sure."
        : "I don't know. You did not teach me this.",
    correct: c.status === "correct",
  }));
}

async function mockReport(session_id) {
  await wait(500);
  const cs = sessions[session_id].concepts;
  const full = cs.filter((c) => c.status === "correct");
  const part = cs.filter((c) => c.status === "partial");
  const none = cs.filter((c) => c.status === "unknown" || c.status === "misconception");
  const score = Math.round(((full.length + part.length * 0.5) / cs.length) * 100);
  return {
    score,
    strengths: full.map((c) => c.name),
    gaps: [...part, ...none].map((c) => c.name),
    tips: [
      "Use simple examples while teaching.",
      "Explain each concept in 2-3 full sentences.",
      "Revisit the concepts marked yellow or red.",
    ],
  };
}