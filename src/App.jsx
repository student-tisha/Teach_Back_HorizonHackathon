import { useEffect, useRef, useState } from "react";
import { getTopics, startSession, teach, getQuiz, getReport } from "./api";

const STATUS_LABEL = {
  unknown: "Not taught yet",
  partial: "Partially learned",
  correct: "Understood",
  misconception: "Misconception",
};

const TOPIC_META = [
  { match: "photosynth", cat: "Biology • Plants • Life", color: ["#22C55E", "#00CFFF"], icon: "leaf" },
  { match: "newton", cat: "Physics • Forces • Motion", color: ["#7C5CFF", "#00CFFF"], icon: "atom" },
  { match: "water", cat: "Earth Science • Water • Nature", color: ["#00CFFF", "#21E6D6"], icon: "drop" },
  { match: "ohm", cat: "Physics • Electricity • Circuits", color: ["#F7C948", "#7C5CFF"], icon: "bolt" },
];
function getTopicMeta(name) {
  const low = (name || "").toLowerCase();
  const found = TOPIC_META.find((m) => low.includes(m.match));
  return found || { cat: "General • Custom Topic", color: ["#7C5CFF", "#00CFFF"], icon: "book" };
}
function TopicIcon({ icon }) {
  const c = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "#fff", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  if (icon === "leaf") return <svg {...c}><path d="M5 20c8 0 14-6 14-14 -8 0-14 6-14 14Z" /><path d="M5 20c2-6 6-10 12-12" /></svg>;
  if (icon === "atom") return <svg {...c}><circle cx="12" cy="12" r="1.6" fill="#fff" /><ellipse cx="12" cy="12" rx="9" ry="3.5" /><ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(60 12 12)" /><ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(120 12 12)" /></svg>;
  if (icon === "drop") return <svg {...c}><path d="M12 3c4 5 6 8 6 11a6 6 0 1 1-12 0c0-3 2-6 6-11Z" /></svg>;
  if (icon === "bolt") return <svg {...c}><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" /></svg>;
  return <svg {...c}><path d="M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4Z" /><path d="M8 8h7M8 12h7" /></svg>;
}
function Logo({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className="logo-icon">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7C5CFF" />
          <stop offset="100%" stopColor="#00CFFF" />
        </linearGradient>
      </defs>
      <path d="M20 6 3 14l17 8 17-8Z" fill="url(#lg)" />
      <path d="M9 18v9c0 3 5 5 11 5s11-2 11-5v-9" stroke="url(#lg)" strokeWidth="2" fill="none" />
      <circle cx="34" cy="16" r="2" fill="#00CFFF" />
    </svg>
  );
}
function RobotSVG({ size = 220 }) {
  return (
    <svg className="robot-svg" width={size} height={size * 1.09} viewBox="0 0 220 240" fill="none">
      <defs>
        <linearGradient id="body2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2835A6" />
          <stop offset="100%" stopColor="#111A4D" />
        </linearGradient>
        <linearGradient id="glow2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7C5CFF" />
          <stop offset="100%" stopColor="#00CFFF" />
        </linearGradient>
      </defs>
      <rect x="70" y="140" width="80" height="70" rx="24" fill="url(#body2)" stroke="url(#glow2)" strokeWidth="2" />
      <circle cx="90" cy="175" r="6" fill="#00CFFF" />
      <rect x="45" y="150" width="18" height="45" rx="9" fill="url(#body2)" stroke="url(#glow2)" strokeWidth="2" />
      <rect x="157" y="150" width="18" height="45" rx="9" fill="url(#body2)" stroke="url(#glow2)" strokeWidth="2" />
      <rect x="55" y="40" width="110" height="95" rx="34" fill="url(#body2)" stroke="url(#glow2)" strokeWidth="2.5" />
      <rect x="80" y="60" width="60" height="45" rx="18" fill="#050A20" />
      <circle cx="98" cy="82" r="7" fill="#00CFFF"><animate attributeName="opacity" values="1;0.4;1" dur="2.2s" repeatCount="indefinite" /></circle>
      <circle cx="122" cy="82" r="7" fill="#00CFFF"><animate attributeName="opacity" values="1;0.4;1" dur="2.2s" repeatCount="indefinite" /></circle>
      <line x1="110" y1="40" x2="110" y2="20" stroke="url(#glow2)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="110" cy="16" r="6" fill="#00CFFF"><animate attributeName="r" values="6;8;6" dur="2s" repeatCount="indefinite" /></circle>
    </svg>
  );
}

export default function App() {
  const [screen, setScreen] = useState("landing");
  const [topics, setTopics] = useState([]);
  const [customTopic, setCustomTopic] = useState("");
  const [topic, setTopic] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [quiz, setQuiz] = useState([]);
  const [report, setReport] = useState(null);
  const [listening, setListening] = useState(false);
  const endRef = useRef(null);
  const heroRef = useRef(null);

  useEffect(() => {
    getTopics().then(setTopics).catch(() => setError("Could not load topics."));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const onHeroMove = (e) => {
    const r = heroRef.current?.getBoundingClientRect();
    if (!r) return;
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    heroRef.current.style.setProperty("--mx", x + "%");
    heroRef.current.style.setProperty("--my", y + "%");
  };

  const startTopic = async (name) => {
    const t = name.trim();
    if (!t || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await startSession(t);
      if (!res.concepts || res.concepts.length === 0) {
        setError("Custom topics need the real API. Pick a preset topic for now.");
        setLoading(false);
        return;
      }
      setTopic(t);
      setSessionId(res.session_id);
      setConcepts(res.concepts);
      setMessages([{ role: "bot", text: res.reply }]);
      setScreen("teach");
    } catch (e) {
      setError("Could not start. Please try again.");
    }
    setLoading(false);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError("");
    setMessages((m) => [...m, { role: "user", text }]);
    setLoading(true);
    try {
      const res = await teach(sessionId, text);
      setConcepts(res.concepts);
      setMessages((m) => [...m, { role: "bot", text: res.reply }]);
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setError("Voice input is not supported. Use Chrome.");
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.onresult = (e) => {
      const said = e.results[0][0].transcript;
      setInput((p) => (p ? p + " " : "") + said);
    };
    rec.start();
  };

  const goQuiz = async () => {
    setLoading(true);
    setError("");
    try {
      const q = await getQuiz(sessionId);
      setQuiz(q);
      setScreen("quiz");
    } catch (e) {
      setError("Could not load quiz.");
    }
    setLoading(false);
  };

  const goReport = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await getReport(sessionId);
      setReport(r);
      setScreen("report");
    } catch (e) {
      setError("Could not load report.");
    }
    setLoading(false);
  };

  const restart = () => {
    setScreen("landing");
    setMessages([]);
    setConcepts([]);
    setQuiz([]);
    setReport(null);
    setError("");
  };

  const total = concepts.length || 1;
  const full = concepts.filter((c) => c.status === "correct").length;
  const part = concepts.filter((c) => c.status === "partial").length;
  const progress = Math.round(((full + part * 0.5) / total) * 100);

  /* ---------------- LANDING ---------------- */
  if (screen === "landing") {
    return (
      <div className="landing" ref={heroRef} onMouseMove={onHeroMove}>
        <div className="grid-overlay" />
        <span className="particle" style={{ top: "18%", left: "10%" }} />
        <span className="particle" style={{ top: "70%", left: "6%", animationDelay: "1s" }} />
        <span className="particle" style={{ top: "30%", left: "92%", animationDelay: "2s" }} />
        <span className="particle" style={{ top: "80%", left: "88%", animationDelay: "0.5s" }} />

        <div className="navbar">
          <div className="nav-logo">
            <Logo />
            <span>TeachBot</span>
          </div>
          <div className="ai-indicator">
            <span className="ai-dot" />
            <span><b>AI Student</b></span>
            <span>· Curious • Learning • Growing</span>
          </div>
        </div>

        <div className="hero">
          <div className="hero-copy">
            <div className="eyebrow">YOUR AI STUDENT</div>
            <h1>
              Teach the bot.
              <br />
              <span className="grad">Learn faster.</span>
            </h1>
            <p>
              Meet a curious AI student. Explain a topic to it, answer its
              questions, and watch your own understanding grow.
            </p>

            <div className="topic-grid">
              {topics.map((t) => {
                const meta = getTopicMeta(t);
                return (
                  <button key={t} className="topic-card" disabled={loading} onClick={() => startTopic(t)}>
                    <span className="topic-icon" style={{ background: `linear-gradient(135deg, ${meta.color[0]}, ${meta.color[1]})` }}>
                      <TopicIcon icon={meta.icon} />
                    </span>
                    <span className="topic-text">
                      <span className="name">{t}</span>
                      <span className="cat">{meta.cat}</span>
                    </span>
                    <svg className="topic-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </button>
                );
              })}
            </div>

            <div className="custom-topic">
              <svg className="sparkle" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l1.6 5.2L19 9l-5.4 1.8L12 16l-1.6-5.2L5 9l5.4-1.8Z" />
              </svg>
              <input
                placeholder="Type your own topic..."
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && startTopic(customTopic)}
                aria-label="Custom topic"
              />
              <button className="btn btn-primary" disabled={loading || !customTopic.trim()} onClick={() => startTopic(customTopic)}>
                {loading ? "Starting..." : (
                  <>
                    Start teaching
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 11l18-8-8 18-2-8-8-2Z" />
                    </svg>
                  </>
                )}
              </button>
            </div>

            {error && <div className="error">{error}</div>}

            <div className="features-row">
              <span className="feature">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00CFFF" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M9 12l2 2 4-4" /></svg>
                Better Understanding
              </span>
              <span className="sep" />
              <span className="feature">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A855F7" strokeWidth="2"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" /></svg>
                Personalized Learning
              </span>
              <span className="sep" />
              <span className="feature">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#21E6D6" strokeWidth="2"><path d="M4 20V10M12 20V4M20 20v-7" /></svg>
                Track Your Progress
              </span>
            </div>
          </div>

          <div className="robot-wrap">
            <span className="bubble b1">What's that?</span>
            <span className="bubble b2">Can you explain this?</span>
            <span className="bubble b3">Why does that happen?</span>
            <RobotSVG />
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- TEACH ---------------- */
  if (screen === "teach") {
    return (
      <div className="shell">
        <div className="topbar">
          <div className="topbar-left">
            <div className="nav-logo"><Logo size={26} /><span>TeachBot</span></div>
            <div className="topbar-divider" />
            <div>
              <h2>Teaching: <span className="topic-name">{topic}</span></h2>
              <div className="sub">Explain in your own words. The bot learns from you.</div>
            </div>
          </div>
          <div className="row">
            <button className="btn-outline" onClick={restart}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 2l4 4-4 4M7 22l-4-4 4-4M21 6H8a4 4 0 0 0-4 4v2M3 18h13a4 4 0 0 0 4-4v-2" /></svg>
              Change topic
            </button>
            <button className="btn-cta" disabled={loading} onClick={goQuiz}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></svg>
              Take the quiz
            </button>
          </div>
        </div>

        <div className="teach-layout">
          <div className="chat">
            <div className="messages">
              {messages.length <= 1 && (
                <div className="ai-intro">
                  <div className="ai-avatar-wrap">
                    <span className="platform" />
                    <RobotSVG size={110} />
                  </div>
                  <div className="speech-panel">
                    <div className="who">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.6 5.2L19 9l-5.4 1.8L12 16l-1.6-5.2L5 9l5.4-1.8Z" /></svg>
                      Hey! I'm your AI student.
                    </div>
                    <p>{messages[0]?.text || "I'm here to learn from you. Explain the topic in your own words. I'll ask questions whenever I need clarification."}</p>
                  </div>
                </div>
              )}
              {messages.slice(messages.length <= 1 ? 1 : 0).map((m, i) => (
                <div key={i} className={"msg-row " + m.role}>
                  <span className="msg-label">{m.role === "bot" ? "TEACHBOT — Student" : "YOU — Teacher"}</span>
                  <div className="msg">{m.text}</div>
                </div>
              ))}
              {loading && (
                <div className="msg-row bot">
                  <span className="msg-label">TEACHBOT — Student</span>
                  <div className="msg typing">Bot is thinking...</div>
                </div>
              )}
              <div ref={endRef} />
            </div>
            {error && <div className="error error-inline">{error}</div>}
            <div className="chat-input">
              <button className={"mic" + (listening ? " on" : "")} onClick={startVoice} title="Voice input" aria-label="Voice input">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 19v3" /></svg>
              </button>
              <div className="chat-input-inner">
                <svg className="sparkle" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.6 5.2L19 9l-5.4 1.8L12 16l-1.6-5.2L5 9l5.4-1.8Z" /></svg>
                <textarea
                  placeholder="Teach the bot here... (Enter to send)"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKey}
                />
              </div>
              <button className="send-btn" disabled={loading || !input.trim()} onClick={send}>
                Send
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 11l18-8-8 18-2-8-8-2Z" /></svg>
              </button>
            </div>
          </div>

          <div className="map-panel">
            <div className="map-title">
              <svg className="brain-icon" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9.5 2a3.5 3.5 0 0 0-3.5 3.5v.6A3 3 0 0 0 4 9v1a3 3 0 0 0 1 2.24V15a3.5 3.5 0 0 0 3.5 3.5V20a2 2 0 0 0 2 2h.5V2Z" /><path d="M14.5 2a3.5 3.5 0 0 1 3.5 3.5v.6A3 3 0 0 1 20 9v1a3 3 0 0 1-1 2.24V15a3.5 3.5 0 0 1-3.5 3.5V20a2 2 0 0 1-2 2h-.5V2Z" /></svg>
              Knowledge map
            </div>
            <div className="understanding-row">
              <span className="label">Bot's understanding</span>
              <span className="pct">{progress}%</span>
            </div>
            <div className="progress"><div style={{ width: progress + "%" }} /></div>
            <div className="legend">
              <span><i className="dot g" /> Understood</span>
              <span><i className="dot y" /> Partial</span>
              <span><i className="dot r" /> Wrong</span>
              <span><i className="dot n" /> Not taught</span>
            </div>
            {concepts.map((c) => (
              <div key={c.id} className={"concept s-" + c.status}>
                <span className="dot" />
                <div className="concept-text">
                  <span className="name">{c.name}</span>
                  <small>{STATUS_LABEL[c.status] || c.status}</small>
                </div>
                <svg className="concept-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6" /></svg>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- QUIZ ---------------- */
  if (screen === "quiz") {
    return (
      <div className="shell">
        <div className="topbar">
          <div className="topbar-left">
            <div className="nav-logo"><Logo size={26} /><span>TeachBot</span></div>
            <div className="topbar-divider" />
            <div>
              <h2>Quiz: <span className="topic-name">{topic}</span></h2>
              <div className="sub">The bot answers using only what you taught it.</div>
            </div>
          </div>
        </div>
        <div className="page">
          <div className="page-inner">
            <h1>Bot's quiz answers</h1>
            {quiz.map((q) => (
              <div key={q.id} className="quiz-card">
                <div className="q">{q.question}</div>
                <div className="a">{q.bot_answer}</div>
                <span className={"badge " + (q.correct ? "ok" : "bad")}>
                  {q.correct ? "Correct" : "Needs teaching"}
                </span>
              </div>
            ))}
            {error && <div className="error">{error}</div>}
            <div className="row">
              <button className="btn-outline" onClick={() => setScreen("teach")}>Teach more</button>
              <button className="btn-cta" disabled={loading} onClick={goReport}>
                {loading ? "Loading..." : "See report card"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- REPORT ---------------- */
  return (
    <div className="shell">
      <div className="topbar">
        <div className="topbar-left">
          <div className="nav-logo"><Logo size={26} /><span>TeachBot</span></div>
          <div className="topbar-divider" />
          <div>
            <h2>Teaching report card</h2>
            <div className="sub">Topic: {topic}</div>
          </div>
        </div>
      </div>
      <div className="page">
        <div className="page-inner">
          <div className="score-wrap">
            <div className="score-circle">
              {report?.score ?? 0}
              <small>Teaching score</small>
            </div>
          </div>

          <div className="report-box good">
            <h3>Strengths</h3>
            <ul>
              {report?.strengths?.length ? report.strengths.map((s, i) => <li key={i}>{s}</li>) : <li>Nothing yet. Teach more concepts.</li>}
            </ul>
          </div>

          <div className="report-box warn">
            <h3>Gaps to improve</h3>
            <ul>
              {report?.gaps?.length ? report.gaps.map((g, i) => <li key={i}>{g}</li>) : <li>No gaps. Great teaching!</li>}
            </ul>
          </div>

          <div className="report-box tip">
            <h3>Tips</h3>
            <ul>
              {(report?.tips || []).map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </div>

          <div className="row">
            <button className="btn-outline" onClick={() => setScreen("teach")}>Teach more</button>
            <button className="btn-cta" onClick={restart}>New topic</button>
          </div>
        </div>
      </div>
    </div>
  );
}