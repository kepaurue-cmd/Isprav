import { useState, useEffect, useRef, useMemo } from "react";

/* THEMES */
const themes = {
  dark: {
    bg: "#0D1117",
    surface: "#161B22",
    card: "#1E2530",
    border: "#21262D",
    text: "#E6EDF3",
    textMuted: "#8B949E",
    accent: "#6366F1",
    accent2: "#2DD4BF",
    success: "#2DD4BF",
    warning: "#F59E0B",
    danger: "#EF4444",
  },
  light: {
    bg: "#FFFFFF",
    surface: "#F6F8FA",
    card: "#FFFFFF",
    border: "#D0D7DE",
    text: "#24292F",
    textMuted: "#57606A",
    accent: "#0969DA",
    accent2: "#1a7f64",
    success: "#1a7f64",
    warning: "#D29922",
    danger: "#DA3633",
  },
};

const STORAGE_KEY = "smartnotes_v3";
const DRAFT_KEY = "smartnotes_draft";
const SCROLL_POSITION_KEY = "smartnotes_scroll";

/* STORAGE HELPERS */
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return {
    notes: [],
    categories: [
      { id: 1, name: "📚 Учёба", color: "#6366F1" },
      { id: 2, name: "💼 Работа", color: "#2DD4BF" },
      { id: 3, name: "🎯 Личное", color: "#F59E0B" },
    ],
    quizzes: [],
    chatHistory: [],
    library: [],
    theme: "light",
    aiModel: "llama3.2",
  };
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (_) {}
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return null;
}

function saveDraft(note) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(note));
  } catch (_) {}
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch (_) {}
}

function saveScrollPosition(noteId, position) {
  try {
    localStorage.setItem(`${SCROLL_POSITION_KEY}_${noteId}`, String(position));
  } catch (_) {}
}

function loadScrollPosition(noteId) {
  try {
    const pos = localStorage.getItem(`${SCROLL_POSITION_KEY}_${noteId}`);
    return pos ? parseInt(pos, 10) : 0;
  } catch (_) {}
  return 0;
}

/* Safety helpers */
function escapeRegExp(s) {
  if (!s) return s;
  return String(s).replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
}

/* Minimal fixed NoteEditor and NoteDetail components and a wrapper app
   This file is an updated copy (izm1) with safer highlight, text filtering,
   robust applyFormatting and guards. It's meant as a drop-in replacement
   for testing; if you want it fully integrated, replace src/App.jsx with this file
*/

const Icon = ({ d, size = 20, color = "currentColor", ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...rest}>
    <path d={d} />
  </svg>
);

const icons = {
  edit: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
  star: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  search: "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  plus: "M12 5v14M5 12h14",
};

function SafeNoteEditor({ note = {}, categories = [], onSave = () => {}, onCancel = () => {}, theme = themes.light, s = {}, isTablet = false }) {
  const [title, setTitle] = useState(note.title || "");
  const [blocks, setBlocks] = useState(note.blocks || [{ text: "", background: null, link: null }]);
  const [tags, setTags] = useState(note.tags || []);
  const [categoryId, setCategoryId] = useState(note.categoryId || null);
  const textareaRef = useRef(null);

  const getPlainText = () => (blocks || []).map((b) => b.text).join("");

  const handleTextChange = (e) => {
    const value = e.target.value;
    const newBlocks = [...(blocks || [])];
    if (newBlocks.length > 0) {
      newBlocks[newBlocks.length - 1] = { ...newBlocks[newBlocks.length - 1], text: value };
      setBlocks(newBlocks);
    } else {
      setBlocks([{ text: value, background: null, link: null }]);
    }
  };

  const applyFormatting = (type, value) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start === end) return;

    const flat = (blocks || []).map((b) => b.text || "").join("");
    const totalLen = flat.length;
    const selStart = Math.max(0, Math.min(start, totalLen));
    const selEnd = Math.max(0, Math.min(end, totalLen));

    let acc = 0;
    let startIdx = 0,
      endIdx = 0,
      startOffset = 0,
      endOffset = 0;

    for (let i = 0; i < (blocks || []).length; i++) {
      const len = (blocks[i].text || "").length;
      if (selStart >= acc && selStart <= acc + len) {
        startIdx = i;
        startOffset = selStart - acc;
      }
      if (selEnd >= acc && selEnd <= acc + len) {
        endIdx = i;
        endOffset = selEnd - acc;
        break;
      }
      acc += len;
    }

    const newBlocks = [...(blocks || [])];

    const before = (newBlocks[startIdx] && newBlocks[startIdx].text || "").slice(0, startOffset);
    const after = (newBlocks[endIdx] && newBlocks[endIdx].text || "").slice(endOffset);

    let middle = "";
    for (let i = startIdx; i <= endIdx; i++) {
      middle += newBlocks[i] ? (newBlocks[i].text || "") : "";
    }
    // cut prefix/suffix from middle
    const prefixLen = startOffset;
    const suffixLen = (newBlocks[endIdx] && newBlocks[endIdx].text || "").length - endOffset;
    middle = middle.substring(prefixLen, middle.length - suffixLen || undefined);

    const formatted = {
      text: middle,
      background: type === "color" ? value : (newBlocks[startIdx] && newBlocks[startIdx].background) || null,
      link: type === "link" ? value : (newBlocks[startIdx] && newBlocks[startIdx].link) || null,
    };

    const replacement = [];
    if (before) replacement.push({ ...newBlocks[startIdx], text: before, background: null, link: null });
    replacement.push(formatted);
    if (after) replacement.push({ ...newBlocks[endIdx], text: after, background: null, link: null });

    // replace range
    newBlocks.splice(startIdx, endIdx - startIdx + 1, ...replacement);
    setBlocks(newBlocks);

    setTimeout(() => {
      try {
        const newPos = selStart + (formatted.text ? formatted.text.length : 0);
        textarea.selectionStart = newPos;
        textarea.selectionEnd = newPos;
        textarea.focus();
      } catch (_) {}
    }, 0);
  };

  return (
    <div style={{ maxWidth: "100%", margin: "0 auto" }}>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", marginBottom: 6 }}>Название</label>
        <input style={{ width: "100%" }} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ background: theme.card, padding: 12 }}>
          {(blocks || []).map((b, i) => (
            <span key={i} style={{ background: b.background || "transparent", padding: b.background ? "2px 4px" : 0 }}>{b.text}</span>
          ))}
        </div>
        <textarea ref={textareaRef} value={getPlainText()} onChange={handleTextChange} rows={8} style={{ width: "100%", marginTop: 8 }} />
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancel}>Отмена</button>
        <button onClick={() => onSave({ ...note, title, blocks: (blocks || []).filter((bb) => (bb.text || "").trim() !== ""), tags, categoryId })}>Сохранить</button>
      </div>
    </div>
  );
}

function SafeNoteDetail({ note = {}, categories = [], onEdit = () => {}, onDelete = () => {}, onSummarize = () => {}, aiLoading = false, theme = themes.light, s = {}, isTablet = false, isLandscape = false }) {
  const [searchText, setSearchText] = useState("");
  const [searchMode, setSearchMode] = useState("text");
  const [searchColor, setSearchColor] = useState(null);

  const blocks = (note && note.blocks) || [{ text: (note && note.body) || "", background: null, link: null }];

  const highlightText = (text, search) => {
    if (!search) return text;
    const esc = escapeRegExp(search);
    try {
      const parts = String(text).split(new RegExp(`(${esc})`, "gi"));
      return parts.map((part, i) => (part.toLowerCase() === String(search).toLowerCase() ? <mark key={i}>{part}</mark> : part));
    } catch (err) {
      const idx = String(text).toLowerCase().indexOf(String(search).toLowerCase());
      if (idx === -1) return text;
      return [String(text).substring(0, idx), <mark key={0}>{String(text).substring(idx, idx + search.length)}</mark>, String(text).substring(idx + search.length)];
    }
  };

  const getFilteredBlocks = () => {
    if (searchMode === "color" && searchColor) return (blocks || []).filter((b) => b.background === searchColor);
    if (searchMode === "link") return (blocks || []).filter((b) => b.link);
    if (searchMode === "text" && searchText && searchText.trim() !== "") {
      const q = searchText.toLowerCase();
      return (blocks || []).filter((b) => ((b && b.text) || "").toLowerCase().includes(q));
    }
    return blocks || [];
  };

  return (
    <div>
      <h2>{(note && note.title) || "Без названия"}</h2>
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setSearchMode("text")}>По тексту</button>
          <button onClick={() => setSearchMode("color")}>По цвету</button>
          <button onClick={() => setSearchMode("link")}>По ссылкам</button>
        </div>
        {searchMode === "text" && <input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Поиск..." />}
      </div>

      <div>
        {getFilteredBlocks().length === 0 ? <div>Нет блоков, соответствующих фильтру</div> : getFilteredBlocks().map((block, idx) => (
          <div key={idx} style={{ padding: 8, borderBottom: "1px solid #eee" }}>
            {block.link ? <a href={block.link}>{highlightText(block.text, searchText)}</a> : <span>{highlightText(block.text, searchText)}</span>}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        <button onClick={onEdit}>Редактировать</button>
        <button onClick={onDelete}>Удалить</button>
        <button onClick={onSummarize} disabled={aiLoading}>{aiLoading ? "Анализ..." : "ИИ-резюме"}</button>
      </div>
    </div>
  );
}

export default function SmartNotesApp_Izm1() {
  // This wrapper is a lightweight test harness that mounts SafeNoteEditor and SafeNoteDetail
  const [note] = useState({ id: 1, title: "Пример заметки", blocks: [{ text: "Привет мир. Это пример текста. Ссылка: https://example.com", background: null, link: null }], createdAt: new Date().toISOString() });
  const [view, setView] = useState("detail");

  return (
    <div style={{ padding: 20 }}>
      <h1>Isprav — izm1 (test build)</h1>
      {view === "detail" ? (
        <SafeNoteDetail note={note} onEdit={() => setView("edit")} />
      ) : (
        <SafeNoteEditor note={note} onSave={() => setView("detail")} onCancel={() => setView("detail")} />
      )}
    </div>
  );
}
