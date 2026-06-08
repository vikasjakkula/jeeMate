import { useState, useRef, useEffect, useCallback } from 'react';
import katex from 'katex';
import './App.css';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') ||
  'https://render-jeemate.onrender.com';

const API_URL = `${API_BASE_URL}/api/solve`;

// ── Chat persistence ──────────────────────────────────────────────────────────
const CHATS_INDEX_KEY = 'jeemate:chats';
const chatStorageKey = (id) => `jeemate:chat:${id}`;

function newChatId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function getChatIdFromHash() {
  const m = window.location.hash.match(/^#\/app\/([a-f0-9-]+)/i);
  return m ? m[1] : null;
}

function goHome() {
  window.history.pushState(null, '', window.location.pathname + window.location.search);
}

function loadChatsIndex() {
  try { return JSON.parse(localStorage.getItem(CHATS_INDEX_KEY) || '[]'); }
  catch { return []; }
}

function saveChatsIndex(list) {
  try { localStorage.setItem(CHATS_INDEX_KEY, JSON.stringify(list)); } catch {}
}

function loadChatMessages(id) {
  try { return JSON.parse(localStorage.getItem(chatStorageKey(id)) || '[]'); }
  catch { return []; }
}

function saveChatMessages(id, messages) {
  try { localStorage.setItem(chatStorageKey(id), JSON.stringify(messages)); } catch {}
}

function deriveTitle(messages) {
  const firstUser = messages.find((m) => m.role === 'user');
  if (!firstUser) return 'New chat';
  const t = (firstUser.text || '').trim();
  if (t) return t.length > 40 ? t.slice(0, 40) + '…' : t;
  return firstUser.image ? 'Image question' : 'New chat';
}

// ── Streak persistence ────────────────────────────────────────────────────────
const STREAK_KEY = 'jeemate:streak';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayDiff(from, to) {
  const a = new Date(from + 'T00:00:00');
  const b = new Date(to + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

function loadStreak() {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (!raw) return { current: 0, longest: 0, lastActiveDate: null };
    const s = JSON.parse(raw);
    if (s.lastActiveDate && dayDiff(s.lastActiveDate, todayStr()) > 1) {
      s.current = 0; // streak broken — last activity older than yesterday
    }
    return s;
  } catch {
    return { current: 0, longest: 0, lastActiveDate: null };
  }
}

function bumpStreak() {
  const today = todayStr();
  const s = loadStreak();
  if (s.lastActiveDate === today) return s; // already counted today
  const diff = s.lastActiveDate ? dayDiff(s.lastActiveDate, today) : null;
  s.current = diff === 1 ? (s.current || 0) + 1 : 1;
  s.lastActiveDate = today;
  if (s.current > (s.longest || 0)) s.longest = s.current;
  try { localStorage.setItem(STREAK_KEY, JSON.stringify(s)); } catch {}
  return s;
}

// ── KaTeX math renderer ───────────────────────────────────────────────────────
function renderKatex(latex, displayMode) {
  try {
    return katex.renderToString(latex.trim(), {
      displayMode,
      throwOnError: false,
      output: 'html',
      trust: false,
    });
  } catch {
    return `<span class="katex-error">${latex}</span>`;
  }
}

// Splits text into plain-text and math segments, renders math with KaTeX.
function MathRenderer({ text }) {
  if (!text) return null;

  const parts = [];
  // Match $$...$$ (display) or $...$ (inline), in that order
  const re = /(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g;
  let last = 0;
  let m;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ t: 'text', v: text.slice(last, m.index) });
    const raw = m[0];
    if (raw.startsWith('$$')) {
      parts.push({ t: 'display', v: raw.slice(2, -2) });
    } else {
      parts.push({ t: 'inline', v: raw.slice(1, -1) });
    }
    last = re.lastIndex;
  }
  if (last < text.length) parts.push({ t: 'text', v: text.slice(last) });

  // If Gemini returns raw LaTeX without $...$ delimiters, render the whole thing as KaTeX.
  // This prevents UI showing strings like "\text{Given:} ... \frac{...}{...}".
  const hasMathDelimiters = parts.some(p => p.t === 'display' || p.t === 'inline');
  if (!hasMathDelimiters) {
    const raw = String(text).trim();
    const looksLikeLatex =
      /\\[a-zA-Z]+/.test(raw) || /\\[{()}[\]]/.test(raw) || /\\_/.test(raw) || /\\\^/.test(raw);
    if (looksLikeLatex) {
      const displayMode = raw.includes('\n') || raw.length > 80;
      return (
        <span
          className={displayMode ? 'katex-display-block' : undefined}
          dangerouslySetInnerHTML={{ __html: renderKatex(raw, displayMode) }}
        />
      );
    }
  }

  return (
    <span>
      {parts.map((p, i) => {
        if (p.t === 'display') {
          return (
            <span
              key={i}
              className="katex-display-block"
              dangerouslySetInnerHTML={{ __html: renderKatex(p.v, true) }}
            />
          );
        }
        if (p.t === 'inline') {
          return (
            <span
              key={i}
              dangerouslySetInnerHTML={{ __html: renderKatex(p.v, false) }}
            />
          );
        }
        // plain text — handle \\ line breaks Gemini emits
        const lines = p.v.split('\\\\');
        return (
          <span key={i}>
            {lines.map((seg, j) => (
              <span key={j}>{j > 0 && <br />}{seg}</span>
            ))}
          </span>
        );
      })}
    </span>
  );
}

// ── Solution card ─────────────────────────────────────────────────────────────
function SolutionCard({ data }) {
  const { solution } = data;

  return (
    <div className="sol-card">
      {/* Chips row */}
      <div className="sol-meta-row">
        {solution.subject && <span className="sol-chip chip-subject">{solution.subject}</span>}
        {solution.topic   && <span className="sol-chip chip-topic">{solution.topic}</span>}
      </div>

      {/* Extracted question */}
      {solution.extracted_question && (
        <div className="sol-section">
          <span className="sol-label">Question</span>
          <div className="sol-block question-block">
            <MathRenderer text={solution.extracted_question} />
          </div>
        </div>
      )}

      {/* Given + Find side by side */}
      {(solution.given || solution.find) && (
        <div className="sol-pair">
          {solution.given && (
            <div className="sol-section sol-half">
              <span className="sol-label">Given</span>
              <div className="sol-block">
                <MathRenderer text={solution.given} />
              </div>
            </div>
          )}
          {solution.find && (
            <div className="sol-section sol-half">
              <span className="sol-label">Find</span>
              <div className="sol-block">
                <MathRenderer text={solution.find} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Formulas used */}
      {solution.formulas_used?.length > 0 && (
        <div className="sol-section">
          <span className="sol-label">Formulas Used</span>
          <div className="formula-list">
            {solution.formulas_used.map((f, i) => (
              <div key={i} className="formula-row">
                <MathRenderer text={String(f)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Steps */}
      {solution.steps?.length > 0 && (
        <div className="sol-section">
          <span className="sol-label">Solution Steps</span>
          <div className="steps-list">
            {solution.steps.map((step, i) => (
              <div key={i} className="step-row">
                <span className="step-num">{i + 1}</span>
                <div className="step-text">
                  <MathRenderer text={step} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Answer */}
      {solution.answer && (
        <div className="sol-section">
          <span className="sol-label">Answer</span>
          <div className="answer-block">
            <MathRenderer text={solution.answer} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── User bubble ───────────────────────────────────────────────────────────────
function UserBubble({ msg }) {
  return (
    <div className="bubble-user">
      {msg.image && (
        <div className="bubble-img">
          <img src={msg.image} alt="uploaded question" />
        </div>
      )}
      {msg.text && <p className="bubble-text">{msg.text}</p>}
    </div>
  );
}

// ── Error bubble ──────────────────────────────────────────────────────────────
function ErrorBubble({ text }) {
  return (
    <div className="bubble-error">
      <span className="error-icon">⚠</span>
      <span>{text}</span>
    </div>
  );
}

// ── Suggested JEE questions shown on the empty starting page ──────────────────
const SUGGESTIONS = [
  { subject: 'Maths',     q: 'Evaluate the definite integral ∫₀^(π/2) sin²x / (sin x + cos x) dx using the king property' },
  { subject: 'Maths',     q: 'Find the sum to n terms of the series 1·2 + 2·3 + 3·4 + … + n(n+1)' },
  { subject: 'Maths',     q: 'How many distinct arrangements of the letters of MISSISSIPPI are possible such that all four S\'s appear together?' },
  { subject: 'Physics',   q: 'A particle is projected at 20 m/s at 60° above the horizontal. Find its maximum height, time of flight and range (take g = 10 m/s²)' },
  { subject: 'Physics',   q: 'Five identical resistors of resistance R are connected in a Wheatstone-bridge configuration. Find the equivalent resistance between the input terminals' },
  { subject: 'Chemistry', q: 'Calculate the pH of a 0.1 M acetic acid solution given Ka = 1.8 × 10⁻⁵' },
];

// ── Response area ─────────────────────────────────────────────────────────────
function ResponseArea({ messages, bottomRef, onPickSuggestion }) {
  return (
    <div className="response-area">
      {messages.length === 0 ? (
        <div className="empty-state">
          <div className="empty-hero">
            <h1 className="hero-title">Generate Complex Steps Using AI</h1>
            <p className="hero-sub">Upload questions · get hints · instant AI step-by-step solutions</p>
          </div>
          <div className="empty-grid">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                type="button"
                className="suggestion-card"
                onClick={() => onPickSuggestion?.(s.q)}
              >
                <span className={`sub-tag sub-${s.subject.toLowerCase()}`}>{s.subject}</span>
                <span className="sub-q">{s.q}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="messages">
          {messages.map((m, i) => {
            if (m.role === 'user')     return <UserBubble key={i} msg={m} />;
            if (m.role === 'solution') return <SolutionCard key={i} data={m.data} />;
            if (m.role === 'error')    return <ErrorBubble key={i} text={m.text} />;
            return null;
          })}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}

// ── ChatGPT-style input bar ───────────────────────────────────────────────────
function InputBar({ onSend, disabled, prefill, onPrefillConsumed }) {
  const [text, setText] = useState('');
  const [image, setImage] = useState(null);
  const fileRef = useRef(null);
  const taRef  = useRef(null);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 110) + 'px';
  }, [text]);

  // Fill the textbox when a suggestion card is clicked
  useEffect(() => {
    if (!prefill) return;
    setText(prefill);
    onPrefillConsumed?.();
    taRef.current?.focus();
  }, [prefill, onPrefillConsumed]);

  // With image: can send even without text (image-only).
  // Without image: require ≥10 chars so backend doesn't reject.
  const canSend = !disabled && (!!image || text.trim().length >= 10);
  const tooShort = !image && text.trim().length > 0 && text.trim().length < 10;

  function handleSend() {
    if (!canSend) return;
    const body = {};
    if (image) body.image = image;
    // Only pass text when it meets the backend's 10-char minimum
    if (text.trim().length >= 10) body.text = text.trim();
    onSend(body);
    setText('');
    setImage(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setImage(ev.target.result);
    reader.readAsDataURL(file);
  }

  return (
    <div className="input-outer">
      {image && (
        <div className="image-thumb-row">
          <div className="image-thumb">
            <img src={image} alt="preview" />
            <button className="remove-thumb" onClick={() => setImage(null)}>✕</button>
          </div>
          <span className="thumb-label">Image ready to send</span>
        </div>
      )}
      <div className={`input-box${disabled ? ' input-disabled' : ''}`}>
        {/* + attach */}
        <button
          className="input-action attach"
          onClick={() => fileRef.current?.click()}
          title="Upload image of question"
          type="button"
          disabled={disabled}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <input type="file" ref={fileRef} accept="image/*"
          onChange={handleFile} style={{ display: 'none' }} />

        {/* Textarea */}
        <textarea
          ref={taRef}
          className="input-ta"
          placeholder="Type a question or upload an image..."
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
          disabled={disabled}
        />

        {/* Send ↑ */}
        <button
          className={`input-action send${canSend ? ' send-active' : ''}`}
          onClick={handleSend}
          disabled={!canSend}
          title="Send (Enter)"
          type="button"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </svg>
        </button>
      </div>

      {tooShort && (
        <p className="input-warn">Need at least 10 characters for text questions.</p>
      )}
      <p className="input-hint">JEEmate may make errors — verify all solutions before use.</p>
    </div>
  );
}

// ── Streak badge ──────────────────────────────────────────────────────────────
function StreakBadge({ streak }) {
  const count = streak?.current || 0;
  const active = count > 0;
  const isTodayActive = streak?.lastActiveDate === todayStr();
  const title = !active
    ? 'Start your streak — ask your first question today!'
    : isTodayActive
      ? `${count}-day streak — keep it going tomorrow! Longest: ${streak.longest}`
      : `${count}-day streak — solve one today to keep it alive!`;

  return (
    <div
      className={`streak${active ? ' streak-active' : ''}${isTodayActive ? ' streak-today' : ''}`}
      title={title}
      aria-label={title}
    >
      <img src="/assets/fire-svgrepo-com.svg" alt="" className="streak-icon" />
      <span className="streak-count">{count}</span>
    </div>
  );
}

// ── Install button (PWA "Add to Home Screen") ─────────────────────────────────
function InstallButton() {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    if (standalone) setInstalled(true);

    function onBeforeInstall(e) {
      e.preventDefault();
      setDeferred(e);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferred(null);
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return null;

  async function handleClick() {
    if (deferred) {
      deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice?.outcome === 'accepted') setDeferred(null);
      return;
    }
    const ua = window.navigator.userAgent || '';
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    if (isIOS) {
      alert('To install JEEmate: tap the Share icon in Safari, then "Add to Home Screen".');
    } else {
      alert('Install not available yet — open this site in Chrome or Edge, or check your browser menu for "Install app".');
    }
  }

  return (
    <button className="install-btn" onClick={handleClick} type="button" title="Install JEEmate as an app">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      Install app
    </button>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ chats, activeId, onNewChat, onSelectChat, onDeleteChat, open, onClose }) {
  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={`sidebar${open ? ' sidebar-open' : ''}`}>
        <button className="new-chat-btn" onClick={onNewChat} type="button">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New chat
        </button>

        <div className="sidebar-label">Chats</div>

        <div className="chat-list">
          {chats.length === 0 ? (
            <div className="chat-empty">No chats yet</div>
          ) : (
            chats.map((c) => (
              <div
                key={c.id}
                className={`chat-item${c.id === activeId ? ' chat-item-active' : ''}`}
                onClick={() => onSelectChat(c.id)}
                title={c.id}
              >
                <span className="chat-item-title">{c.title}</span>
                <button
                  className="chat-item-del"
                  onClick={(e) => { e.stopPropagation(); onDeleteChat(c.id); }}
                  title="Delete chat"
                  type="button"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>

        <InstallButton />
      </aside>
    </>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  // chatId is the UUID embedded in the URL hash (#/app/<uuid>), or null on the home page
  const [chatId, setChatId] = useState(() => getChatIdFromHash());
  const [chats, setChats]       = useState(() => loadChatsIndex());
  const [messages, setMessages] = useState(() => {
    const id = getChatIdFromHash();
    return id ? loadChatMessages(id) : [];
  });
  const [loading, setLoading]   = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [streak, setStreak]     = useState(() => loadStreak());
  const [prefill, setPrefill]   = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // React to back/forward navigation between chats (and back to home)
  useEffect(() => {
    function onHash() {
      const id = getChatIdFromHash();
      if (id !== chatId) {
        setChatId(id);
        setMessages(id ? loadChatMessages(id) : []);
      }
    }
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [chatId]);

  // Persist messages + bump this chat to the top of the index whenever it changes
  useEffect(() => {
    if (!chatId || messages.length === 0) return;
    saveChatMessages(chatId, messages);
    const title = deriveTitle(messages);
    setChats((prev) => {
      const without = prev.filter((c) => c.id !== chatId);
      const next = [{ id: chatId, title, updatedAt: Date.now() }, ...without];
      saveChatsIndex(next);
      return next;
    });
  }, [messages, chatId]);

  const switchToChat = useCallback((id) => {
    if (id === chatId) { setSidebarOpen(false); return; }
    window.history.pushState(null, '', `#/app/${id}`);
    setChatId(id);
    setMessages(loadChatMessages(id));
    setSidebarOpen(false);
  }, [chatId]);

  const handleNewChat = useCallback(() => {
    goHome();
    setChatId(null);
    setMessages([]);
    setSidebarOpen(false);
  }, []);

  const handleDeleteChat = useCallback((id) => {
    try { localStorage.removeItem(chatStorageKey(id)); } catch {}
    setChats((prev) => {
      const next = prev.filter((c) => c.id !== id);
      saveChatsIndex(next);
      return next;
    });
    if (id === chatId) handleNewChat();
  }, [chatId, handleNewChat]);

  async function handleSend({ text, image }) {
    // First send on the home page: mint a UUID and slide into #/app/<uuid>
    if (!chatId) {
      const id = newChatId();
      window.history.replaceState(null, '', `#/app/${id}`);
      setChatId(id);
    }
    // Push user bubble immediately and bump today's streak
    setMessages(prev => [...prev, { role: 'user', text: text || '', image: image || null }]);
    setStreak(bumpStreak());
    setLoading(true);

    try {
      const body = {};
      if (text)  body.text        = text;
      if (image) body.imageBase64 = image; // data-URL — backend strips the prefix

      const res  = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || data.hint || `Server error ${res.status}`);
      }

      setMessages(prev => [...prev, { role: 'solution', data }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'error', text: err.message }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="layout">
      <Sidebar
        chats={chats}
        activeId={chatId}
        onNewChat={handleNewChat}
        onSelectChat={switchToChat}
        onDeleteChat={handleDeleteChat}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="layout-main">
        <div className="shell">
          {/* ── Header ── */}
          <header className="top-bar">
            <button
              className="sidebar-toggle"
              onClick={() => setSidebarOpen((v) => !v)}
              title="Toggle chats"
              type="button"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6"  x2="21" y2="6"  />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="brand">
              <svg className="brand-icon" width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              JEEmate
            </div>
            <div className="top-right">
              <StreakBadge streak={streak} />
              <div className="exam-tags">
                <span className="tag">JEE</span>
                <span className="tag">EAMCET</span>
                <span className="tag">CBSE</span>
              </div>
            </div>
          </header>

          {/* ── Messages (hero shown inside empty-state) ── */}
          <ResponseArea
            messages={messages}
            bottomRef={bottomRef}
            onPickSuggestion={setPrefill}
          />

          {/* ── Loading ── */}
          {loading && (
            <div className="loading-row">
              <div className="ai-avatar-sm">AI</div>
              <span className="dot-pulse" />
              <span className="dot-pulse" style={{ animationDelay: '0.15s' }} />
              <span className="dot-pulse" style={{ animationDelay: '0.3s' }} />
              <span className="loading-label">Generating solution…</span>
            </div>
          )}

          {/* ── Input ── */}
          <InputBar
            key={chatId}
            onSend={handleSend}
            disabled={loading}
            prefill={prefill}
            onPrefillConsumed={() => setPrefill(null)}
          />
        </div>
      </div>
    </div>
  );
}
