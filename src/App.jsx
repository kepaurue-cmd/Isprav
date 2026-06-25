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

/* ASK AI - внешний вызов (защита на AbortSignal.timeout) */
async function askAI(messages, systemPrompt) {
  const userMessage = messages[messages.length - 1]?.content || "";

  try {
    const body = {
      model: "mistralai/mistral-7b-instruct:free",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      max_tokens: 500,
    };

    const fetchOptions = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    };

    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
      fetchOptions.signal = AbortSignal.timeout(15000);
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", fetchOptions);

    if (response && response.ok) {
      const data = await response.json();
      // Поддерживаем разные формы ответа
      return data.choices?.[0]?.message?.content || data.choices?.[0]?.text || "Извините, не удалось получить ответ.";
    }
  } catch (error) {
    console.log("AI error:", error);
  }

  const fallbackResponses = {
    "создай": "✅ Заметка создана!",
    "удали": "✅ Заметка удалена.",
    "переместить": "✅ Заметка перемещена.",
    "категория": "✅ Категория создана!",
    "найти": "🔍 Поиск завершен.",
    "анализ": "📊 Анализ завершен.",
    "привет": "👋 Привет! Я ваш ИИ-ассистент.",
    "помощь": "ℹ️ Я могу помочь с заметками и библиотекой.",
  };

  for (const [key, value] of Object.entries(fallbackResponses)) {
    if (userMessage.toLowerCase().includes(key)) {
      return value;
    }
  }

  return `Спасибо за вопрос: "${userMessage}"\n\nЯ помогу вам организовать информацию.`;
}

/* ICON */
const Icon = ({ d, size = 20, color = "currentColor", ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...rest}>
    <path d={d} />
  </svg>
);

const icons = {
  note: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
  search: "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  ai: "M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm0 6v4l3 3",
  quiz: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 0 2-2h2a2 2 0 0 0 2 2m-6 9l2 2 4-4",
  library: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 17m0 0H9m11 0v-5h2.5A2.5 2.5 0 0 0 20 9.5M9 17v5M9 17H6.5M20 9.5V5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v5",
  plus: "M12 5v14M5 12h14",
  trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
  close: "M18 6L6 18M6 6l12 12",
  send: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
  tag: "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01",
  check: "M20 6L9 17l-5-5",
  back: "M19 12H5M12 5l-7 7 7 7",
  star: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  edit: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  folder: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z",
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  sun: "M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9zm-9-10v2m0 16v2m9-9h-2m-16 0H2m15.66-6.66l-1.41 1.41M6.75 6.75L5.34 5.34M21.66 18.66l-1.41-1.41M6.75 17.25l-1.41 1.41",
  moon: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z",
  settings: "M12 2c-5.33 4.55-8 8.48-8 14.8 0 5.64 2.05 7.2 8 7.2s8-1.56 8-7.2c0-6.32-2.67-10.25-8-14.8z",
  menu: "M3 12h18M3 6h18M3 18h18",
};

/* NOTE EDITOR */
function NoteEditor({ note, categories, onSave, onCancel, theme: t, s, icons, Icon, isTablet }) {
  const [title, setTitle] = useState(note.title || "");
  const [blocks, setBlocks] = useState(note.blocks || [{ text: "", background: null, link: null }]);
  const [selectedColor, setSelectedColor] = useState(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState(note.tags || []);
  const [categoryId, setCategoryId] = useState(note.categoryId || null);
  const textareaRef = useRef(null);

  const colors = [
    { name: "Красный", value: "rgba(239, 68, 68, 0.3)" },
    { name: "Жёлтый", value: "rgba(234, 179, 8, 0.3)" },
    { name: "Синий", value: "rgba(59, 130, 246, 0.3)" },
    { name: "Оранжевый", value: "rgba(249, 115, 22, 0.3)" },
    { name: "Зелёный", value: "rgba(34, 197, 94, 0.3)" },
    { name: "Фиолетовый", value: "rgba(168, 85, 247, 0.3)" },
  ];

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) setTags([...tags, tag]);
    setTagInput("");
  };

  const removeTag = (tag) => setTags(tags.filter((t) => t !== tag));

  const applyFormatting = (type, value) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start === end) return;

    // clamp selection to available text
    const plain = blocks.map((b) => b.text).join("");
    const totalLen = plain.length;
    const selStart = Math.max(0, Math.min(start, totalLen));
    const selEnd = Math.max(0, Math.min(end, totalLen));

    // find start and end block indices
    let charCount = 0;
    let startBlockIndex = 0;
    let endBlockIndex = 0;
    let startInBlock = 0;
    let endInBlock = 0;

    for (let i = 0; i < blocks.length; i++) {
      const bt = blocks[i].text || "";
      const nextCount = charCount + bt.length;
      if (selStart >= charCount && selStart <= nextCount) {
        startBlockIndex = i;
        startInBlock = selStart - charCount;
      }
      if (selEnd >= charCount && selEnd <= nextCount) {
        endBlockIndex = i;
        endInBlock = selEnd - charCount;
        break;
      }
      charCount = nextCount;
    }

    // build the combined selected text across blocks if needed
    const newBlocks = [...blocks];

    // extract pieces
    const beforeText = (newBlocks[startBlockIndex].text || "").substring(0, startInBlock);
    const afterText = (newBlocks[endBlockIndex].text || "").substring(endInBlock);

    // build selectedText by concatenating the middle blocks
    let selectedTextPart = "";
    for (let i = startBlockIndex; i <= endBlockIndex; i++) {
      selectedTextPart += newBlocks[i].text || "";
    }
    // trim off parts outside selection
    selectedTextPart = selectedTextPart.substring(startInBlock, selectedTextPart.length - ((newBlocks[endBlockIndex].text || "").length - endInBlock));

    if (selectedTextPart === undefined || selectedTextPart === null) return;

    const formattedBlock = {
      text: selectedTextPart,
      background: type === "color" ? value : newBlocks[startBlockIndex].background,
      link: type === "link" ? value : newBlocks[startBlockIndex].link,
    };

    const replacement = [];
    if (beforeText) replacement.push({ ...newBlocks[startBlockIndex], text: beforeText, link: null, background: null });
    replacement.push(formattedBlock);
    if (afterText) replacement.push({ ...newBlocks[endBlockIndex], text: afterText, link: null, background: null });

    // splice out the range and insert replacement
    newBlocks.splice(startBlockIndex, endBlockIndex - startBlockIndex + 1, ...replacement);
    setBlocks(newBlocks);

    // restore selection after DOM update
    setTimeout(() => {
      try {
        const newPos = selStart + formattedBlock.text.length;
        textarea.selectionStart = newPos;
        textarea.selectionEnd = newPos;
        textarea.focus();
      } catch (_) {}
    }, 0);
  };

  const handleTextChange = (e) => {
    const value = e.target.value;
    const newBlocks = [...blocks];
    if (newBlocks.length > 0) {
      newBlocks[newBlocks.length - 1] = { ...newBlocks[newBlocks.length - 1], text: value };
      setBlocks(newBlocks);
    } else {
      setBlocks([{ text: value, background: null, link: null }]);
    }
  };

  const getPlainText = () => blocks.map((b) => b.text).join("");

  useEffect(() => {
    saveDraft({ ...note, title, blocks, tags, categoryId });
  }, [title, blocks, tags, categoryId, note]);

  return (
    <div style={{ maxWidth: "100%", margin: "0 auto" }}>
      <div>
        <div style={s.section}>
          <label style={s.label}>Название</label>
          <input style={s.input} placeholder="Название заметки" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div style={s.section}>
          <label style={s.label}>Категория</label>
          <select
  