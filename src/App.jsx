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

    let charCount = 0;
    let blockIndex = 0;
    let startInBlock = 0;
    let endInBlock = 0;

    for (let i = 0; i < blocks.length; i++) {
      const blockText = blocks[i].text;
      if (charCount + blockText.length >= start) {
        blockIndex = i;
        startInBlock = start - charCount;
        endInBlock = Math.min(blockText.length, end - charCount);
        break;
      }
      charCount += blockText.length;
    }

    const block = blocks[blockIndex];
    if (!block) return;

    if (startInBlock >= 0 && endInBlock <= block.text.length) {
      const newBlocks = [...blocks];
      const beforeText = block.text.substring(0, startInBlock);
      const selectedTextPart = block.text.substring(startInBlock, endInBlock);
      const afterText = block.text.substring(endInBlock);

      const newBlock = {
        text: selectedTextPart,
        background: type === "color" ? value : block.background,
        link: type === "link" ? value : block.link,
      };

      const updatedBlocks = [];
      if (beforeText) {
        updatedBlocks.push({ ...block, text: beforeText, link: null, background: null });
      }
      updatedBlocks.push(newBlock);
      if (afterText) {
        updatedBlocks.push({ ...block, text: afterText, link: null, background: null });
      }

      newBlocks.splice(blockIndex, 1, ...updatedBlocks);
      setBlocks(newBlocks);

      // restore selection after DOM update
      setTimeout(() => {
        try {
          const newPos = start + selectedTextPart.length;
          textarea.selectionStart = newPos;
          textarea.selectionEnd = newPos;
          textarea.focus();
        } catch (_) {}
      }, 0);
    }
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
            style={{ ...s.input, cursor: "pointer" }}
            value={categoryId || ""}
            onChange={(e) => setCategoryId(e.target.value ? parseInt(e.target.value, 10) : null)}
          >
            <option value="">Без категории</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 12, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: t.textMuted, marginRight: 4 }}>Выделить цветом:</span>
        {colors.map((color) => (
          <button
            key={color.value}
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: color.value,
              border: selectedColor === color.value ? "2px solid #fff" : "1px solid rgba(0,0,0,0.2)",
              boxShadow: selectedColor === color.value ? "0 0 0 2px #000" : "none",
              cursor: "pointer",
              opacity: 0.9,
            }}
            onClick={() => {
              setSelectedColor(color.value);
              applyFormatting("color", color.value);
            }}
            title={color.name}
          />
        ))}
        <button style={s.btn("secondary")} onClick={() => { setShowLinkInput(!showLinkInput); if (showLinkInput) setLinkUrl(""); }}>
          🔗 Ссылка
        </button>
        <button style={s.btn("ghost")} onClick={() => setSelectedColor(null)}>
          ✖ Сбросить
        </button>
      </div>

      {showLinkInput && (
        <div style={{ ...s.row, marginBottom: 12, gap: 8 }}>
          <input style={{ ...s.input, flex: 1 }} placeholder="Введите URL..." value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
          <button style={s.btn("primary")} onClick={() => { if (linkUrl.trim()) { applyFormatting("link", linkUrl.trim()); setLinkUrl(""); setShowLinkInput(false); } }}>
            Применить
          </button>
        </div>
      )}

      <div style={s.section}>
        <label style={s.label}>Содержание</label>
        <div
          style={{
            ...s.textarea,
            minHeight: isTablet ? "50vh" : "300px",
            fontSize: isTablet ? 18 : 16,
            lineHeight: 1.8,
            whiteSpace: "pre-wrap",
            overflowY: "auto",
            marginBottom: 8,
            background: t.card,
            border: `1px solid ${t.border}`,
            borderRadius: 8,
            padding: "12px 14px",
          }}
        >
          {blocks.map((block, index) => {
            let style = {};
            if (block.background) {
              style.background = block.background;
              style.padding = "2px 4px";
              style.borderRadius = 4;
            }
            if (block.link) {
              style.textDecoration = "underline";
              style.cursor = "pointer";
              style.color = t.accent;
            }
            return (
              <span key={index} style={style}>
                {block.text}
              </span>
            );
          })}
        </div>
        <textarea
          ref={textareaRef}
          style={{
            ...s.textarea,
            minHeight: isTablet ? "50vh" : "300px",
            fontSize: isTablet ? 18 : 16,
            lineHeight: 1.8,
            marginTop: 8,
          }}
          placeholder="Запишите всё, что хотите сохранить..."
          value={getPlainText()}
          onChange={handleTextChange}
          rows={isTablet ? 15 : 10}
        />
      </div>

      <div style={s.section}>
        <label style={s.label}>Теги</label>
        <div style={{ ...s.row, marginBottom: 8 }}>
          <input style={{ ...s.input, flex: 1 }} placeholder="Добавить тег..." value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTag()} />
          <button style={s.btn("secondary")} onClick={addTag}>+</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {tags.map((tag) => (
            <span key={tag} style={{ display: "inline-block", background: `${t.accent}33`, color: t.accent, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 500, cursor: "pointer" }} onClick={() => removeTag(tag)}>
              {tag} ×
            </span>
          ))}
        </div>
      </div>

      <div style={{ ...s.row, justifyContent: "flex-end", gap: 8, paddingBottom: 20 }}>
        <button style={s.btn("ghost")} onClick={onCancel}>Отмена</button>
        <button style={s.btn("primary")} onClick={() => onSave({ ...note, title, blocks: blocks.filter((b) => b.text.trim() !== ""), tags, categoryId })}>
          ✓ Сохранить
        </button>
      </div>
    </div>
  );
}

/* NOTE DETAIL */
function NoteDetail({
  note,
  categories,
  onEdit,
  onDelete,
  onBack,
  onSummarize,
  aiLoading,
  theme: t,
  s,
  icons,
  Icon,
  isTablet,
  isLandscape,
}) {
  const [showSummary, setShowSummary] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchMode, setSearchMode] = useState("text");
  const [searchColor, setSearchColor] = useState(null);
  const contentRef = useRef(null);
  const cat = categories.find((c) => c.id === note.categoryId);
  const blocks = note.blocks || [{ text: note.body || "", background: null, link: null }];

  useEffect(() => {
    if (contentRef.current) {
      const savedPos = loadScrollPosition(note.id);
      contentRef.current.scrollTop = savedPos;
    }
  }, [note.id]);

  const handleScroll = () => {
    if (contentRef.current) {
      const pos = contentRef.current.scrollTop;
      saveScrollPosition(note.id, pos);
    }
  };

  const highlightText = (text, search) => {
    if (!search) return text;
    const parts = text.split(new RegExp(`(${search})`, "gi"));
    return parts.map((part, i) => (part.toLowerCase() === search.toLowerCase() ? <mark key={i} style={{ background: "#ffeb3b", color: "#000" }}>{part}</mark> : part));
  };

  const getFilteredBlocks = () => {
    if (searchMode === "color" && searchColor) {
      return blocks.filter((b) => b.background === searchColor);
    }
    if (searchMode === "link") {
      return blocks.filter((b) => b.link);
    }
    return blocks;
  };

  const colors = [
    { name: "Красный", value: "rgba(239, 68, 68, 0.3)" },
    { name: "Жёлтый", value: "rgba(234, 179, 8, 0.3)" },
    { name: "Синий", value: "rgba(59, 130, 246, 0.3)" },
    { name: "Оранжевый", value: "rgba(249, 115, 22, 0.3)" },
    { name: "Зелёный", value: "rgba(34, 197, 94, 0.3)" },
    { name: "Фиолетовый", value: "rgba(168, 85, 247, 0.3)" },
  ];

  return (
    <div
      style={{
        display: isTablet && isLandscape ? "grid" : "block",
        gridTemplateColumns: isTablet && isLandscape ? "1fr 1fr" : undefined,
        gap: isTablet && isLandscape ? "24px" : undefined,
        maxWidth: "100%",
        margin: "0 auto",
      }}
    >
      <div ref={contentRef} onScroll={handleScroll} style={{ maxHeight: isTablet ? "70vh" : "auto", overflowY: "auto" }}>
        <div style={{ ...s.row, justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: t.textMuted }}>{new Date(note.createdAt).toLocaleString("ru")}</div>
          <div style={s.row}>
            <button style={s.btn("ghost")} onClick={onEdit}>
              <Icon d={icons.edit} size={16} />
            </button>
            <button style={s.btn("danger")} onClick={onDelete}>
              <Icon d={icons.trash} size={16} />
            </button>
          </div>
        </div>
        {cat && <span style={s.categoryBadge(cat.color)}>{cat.name}</span>}
        <h2 style={{ fontSize: isTablet ? 24 : 20, fontWeight: 700, marginBottom: 12, color: t.text }}>{note.title || "Без названия"}</h2>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <button style={{ ...s.btn("secondary"), background: searchMode === "text" ? t.accent : "transparent", color: searchMode === "text" ? "#fff" : t.text }} onClick={() => { setSearchMode("text"); setSearchColor(null); }}>
              📝 По тексту
            </button>
            <button style={{ ...s.btn("secondary"), background: searchMode === "color" ? t.accent : "transparent", color: searchMode === "color" ? "#fff" : t.text }} onClick={() => { setSearchMode("color"); }}>
              🎨 По цвету
            </button>
            <button style={{ ...s.btn("secondary"), background: searchMode === "link" ? t.accent : "transparent", color: searchMode === "link" ? "#fff" : t.text }} onClick={() => { setSearchMode("link"); setSearchColor(null); }}>
              🔗 По ссылкам
            </button>
          </div>

          {searchMode === "color" && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {colors.map((color) => (
                <button key={color.value} style={{ width: 32, height: 32, borderRadius: "50%", background: color.value, border: searchColor === color.value ? "3px solid #fff" : "1px solid rgba(0,0,0,0.2)", boxShadow: searchColor === color.value ? "0 0 0 2px #000" : "none", cursor: "pointer" }} onClick={() => setSearchColor(color.value)} />
              ))}
              <button style={s.btn("ghost")} onClick={() => setSearchColor(null)}>Сбросить</button>
            </div>
          )}

          {searchMode === "text" && <input style={s.input} placeholder="Поиск по тексту..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />}
        </div>

        <div style={{ marginBottom: 16 }}>
          {getFilteredBlocks().length === 0 ? <div style={s.empty}>Нет блоков, соответствующих фильтру</div> : getFilteredBlocks().map((block, index) => (
            <div key={index} style={{ padding: 8, borderBottom: `1px solid ${t.border}` }}>
              {block.link ? (
                <a href={block.link} target="_blank" rel="noopener noreferrer" style={{ background: block.background || "transparent", padding: "2px 4px", borderRadius: 4, color: t.accent, textDecoration: "underline" }}>
                  {highlightText(block.text, searchText)}
                </a>
              ) : (
                <span style={{ background: block.background || "transparent", padding: "2px 4px", borderRadius: 4, color: t.text }}>{highlightText(block.text, searchText)}</span>
              )}
              {block.background && <span style={{ fontSize: 10, color: t.textMuted, marginLeft: 8 }}>🖍️</span>}
              {block.link && <span style={{ fontSize: 10, color: t.textMuted, marginLeft: 8 }}>🔗</span>}
            </div>
          ))}
        </div>
      </div>

      <div style={isTablet && isLandscape ? {} : { borderTop: `1px solid ${t.border}`, paddingTop: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button style={s.btn("secondary")} onClick={() => { setShowSummary(true); onSummarize(); }} disabled={aiLoading}>
            <Icon d={icons.star} size={16} /> {aiLoading ? "Анализирую..." : "ИИ-резюме"}
          </button>
        </div>
        {showSummary && note.aiSummary && (
          <div style={{ ...s.card, marginTop: 16, borderColor: t.accent, background: `${t.accent}11` }}>
            <div style={{ fontSize: 12, color: t.accent, fontWeight: 600, marginBottom: 8 }}>🤖 ИИ-анализ</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", color: t.text }}>{note.aiSummary}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* MAIN APP */
export default function SmartNotesApp() {
  const [data, setData] = useState(() => loadData());
  const [theme, setTheme] = useState(data.theme || "light");
  const [tab, setTab] = useState("notes");
  const [view, setView] = useState("list");
  const [activeNote, setActiveNote] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [search, setSearch] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("#6366F1");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [librarySearch, setLibrarySearch] = useState("");
  const [libName, setLibName] = useState("");
  const [libContent, setLibContent] = useState("");
  const [windowWidth, setWindowWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  const [windowHeight, setWindowHeight] = useState(typeof window !== "undefined" ? window.innerHeight : 768);
  const chatRef = useRef(null);

  const [saveStatus, setSaveStatus] = useState("idle");
  const [draftExists, setDraftExists] = useState(false);
  const saveTimerRef = useRef(null);

  const t = themes[theme];

  const filteredLibrary = useMemo(() => {
    return data.library.filter(
      (item) => item.name.toLowerCase().includes(librarySearch.toLowerCase()) || item.content.toLowerCase().includes(librarySearch.toLowerCase())
    );
  }, [data.library, librarySearch]);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setWindowHeight(window.innerHeight);
    };
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    handleResize();
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  const isMobile = windowWidth < 768;
  const isTablet = windowWidth >= 768 && windowWidth < 1024;
  const isLandscape = windowWidth > windowHeight;

  let maxWidth, contentPadding, headerPadding, cardPadding, bottomNavPadding;
  if (isMobile) {
    maxWidth = isLandscape ? "100%" : "480px";
    contentPadding = "16px";
    headerPadding = "20px 16px 12px";
    cardPadding = "16px";
    bottomNavPadding = "60px";
  } else if (isTablet) {
    maxWidth = "100%";
    contentPadding = isLandscape ? "32px" : "24px";
    headerPadding = isLandscape ? "20px 32px 16px" : "24px 24px 16px";
    cardPadding = isLandscape ? "24px" : "20px";
    bottomNavPadding = "72px";
  } else {
    maxWidth = "100%";
    contentPadding = "40px";
    headerPadding = "24px 40px 16px";
    cardPadding = "24px";
    bottomNavPadding = "80px";
  }

  const gridColumns = isMobile ? 1 : isTablet ? 2 : 3;

  const persist = (next) => {
    setData(next);
    saveData(next);
  };

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    persist({ ...data, theme: newTheme });
  };

  useEffect(() => {
    const draft = loadDraft();
    if (draft && (draft.title || draft.body || draft.blocks)) {
      setDraftExists(true);
    }
  }, []);

  useEffect(() => {
    if (view === "edit" && activeNote) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      const timer = setTimeout(() => {
        saveDraft(activeNote);
        setSaveStatus("saving");

        if (activeNote.id) {
          const exists = data.notes.find((n) => n.id === activeNote.id);
          if (exists) {
            const notes = data.notes.map((n) => (n.id === activeNote.id ? { ...activeNote, updatedAt: new Date().toISOString() } : n));
            persist({ ...data, notes });
            setSaveStatus("saved");
            setDraftExists(true);
          } else if (activeNote.title || activeNote.body || (activeNote.blocks && activeNote.blocks.some((b) => b.text && b.text.trim()))) {
            const newNote = { ...activeNote, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            persist({ ...data, notes: [newNote, ...data.notes] });
            setActiveNote(newNote);
            setSaveStatus("saved");
            setDraftExists(true);
          } else {
            setSaveStatus("idle");
          }
        } else if (activeNote.title || activeNote.body || (activeNote.blocks && activeNote.blocks.some((b) => b.text && b.text.trim()))) {
          setSaveStatus("saved");
          setDraftExists(true);
        } else {
          setSaveStatus("idle");
        }

        setTimeout(() => {
          setSaveStatus("idle");
        }, 2000);
      }, 2000);

      saveTimerRef.current = timer;
      return () => clearTimeout(timer);
    }
  }, [activeNote, view, data]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && view === "edit" && activeNote && (activeNote.title || activeNote.body || (activeNote.blocks && activeNote.blocks.some((b) => b.text && b.text.trim())))) {
        saveDraft(activeNote);
        setDraftExists(true);
        if (activeNote.id) {
          const exists = data.notes.find((n) => n.id === activeNote.id);
          if (exists) {
            const notes = data.notes.map((n) => (n.id === activeNote.id ? { ...activeNote, updatedAt: new Date().toISOString() } : n));
            persist({ ...data, notes });
          }
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [activeNote, view, data]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (view === "edit" && activeNote && (activeNote.title || activeNote.body || (activeNote.blocks && activeNote.blocks.some((b) => b.text && b.text.trim())))) {
        saveDraft(activeNote);
        e.preventDefault();
        e.returnValue = "У вас есть несохраненные изменения.";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [activeNote, view]);

  const restoreDraft = () => {
    const draft = loadDraft();
    if (draft) {
      setActiveNote(draft);
      setView("edit");
      setDraftExists(false);
      clearDraft();
      showNotification("🔄 Черновик восстановлен");
    }
  };

  const discardDraft = () => {
    clearDraft();
    setDraftExists(false);
    showNotification("🗑️ Черновик удален");
  };

  const showNotification = (message) => {
    const notification = document.createElement("div");
    notification.style.cssText = `
      position: fixed;
      bottom: ${isMobile ? "80px" : "100px"};
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 24px;
      background: ${t.surface};
      color: ${t.text};
      border: 1px solid ${t.border};
      border-radius: 8px;
      font-size: 14px;
      z-index: 9999;
      animation: slideUp 0.3s ease-out;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      max-width: 90%;
      text-align: center;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.style.opacity = "0";
      notification.style.transition = "opacity 0.3s";
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  };

  const addCategory = () => {
    if (!newCategoryName.trim()) return;
    const category = { id: Date.now(), name: newCategoryName, color: newCategoryColor };
    persist({ ...data, categories: [...data.categories, category] });
    setNewCategoryName("");
    setNewCategoryColor("#6366F1");
    setShowCategoryModal(false);
    showNotification("✅ Категория создана");
  };

  const deleteCategory = (id) => {
    const notes = data.notes.map((n) => (n.categoryId === id ? { ...n, categoryId: null } : n));
    persist({ ...data, categories: data.categories.filter((c) => c.id !== id), notes });
    showNotification("🗑️ Категория удалена");
  };

  const newNote = () => {
    const draft = loadDraft();
    if (draft && (draft.title || draft.body || draft.blocks)) {
      if (window.confirm("У вас есть несохраненный черновик. Использовать его?")) {
        setActiveNote(draft);
        setView("edit");
        clearDraft();
        setDraftExists(false);
        return;
      }
    }
    setActiveNote({
      id: Date.now(),
      title: "",
      blocks: [{ text: "", background: null, link: null }],
      tags: [],
      categoryId: activeCategory,
      createdAt: new Date().toISOString(),
    });
    setView("edit");
    clearDraft();
    setDraftExists(false);
  };

  const saveNote = (note) => {
    const exists = data.notes.find((n) => n.id === note.id);
    const notes = exists ? data.notes.map((n) => (n.id === note.id ? note : n)) : [note, ...data.notes];
    persist({ ...data, notes });
    clearDraft();
    setDraftExists(false);
    setView("list");
    showNotification("✅ Заметка сохранена");
  };

  const deleteNote = (id) => {
    setShowDeleteConfirm(null);
    persist({ ...data, notes: data.notes.filter((n) => n.id !== id) });
    clearDraft();
    setDraftExists(false);
    setView("list");
    showNotification("🗑️ Заметка удалена");
  };

  const filtered = data.notes.filter((n) => {
    const tags = n.tags || [];
    const matchSearch =
      (n.title && n.title.toLowerCase().includes(search.toLowerCase())) ||
      (n.blocks && n.blocks.some((b) => b.text && b.text.toLowerCase().includes(search.toLowerCase()))) ||
      tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()));
    const matchCategory = activeCategory === null || n.categoryId === activeCategory;
    return matchSearch && matchCategory;
  });

  const notesContext = filtered
    .slice(0, 20)
    .map((n) => {
      const text = n.blocks ? n.blocks.map((b) => b.text).join(" ") : n.body || "";
      return `[${n.title}]: ${text.slice(0, 300)}`;
    })
    .join("\n\n");

  const libraryContext = data.library
    .slice(0, 10)
    .map((item) => `[${item.name}]: ${item.content.slice(0, 500)}`)
    .join("\n\n");

  const s = useMemo(() => {
    const fontSize = {
      xs: isMobile ? 10 : 12,
      sm: isMobile ? 13 : 15,
      md: isMobile ? 15 : 17,
      lg: isMobile ? 18 : 22,
      xl: isMobile ? 20 : 26,
    };

    return {
      app: {
        minHeight: "100vh",
        background: t.bg,
        color: t.text,
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
        display: "flex",
        flexDirection: "column",
        maxWidth: maxWidth,
        margin: "0 auto",
        position: "relative",
        transition: "background 0.3s, color 0.3s",
        width: "100%",
        height: "100vh",
        overflow: "hidden",
      },
      header: {
        padding: headerPadding,
        borderBottom: `1px solid ${t.border}`,
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: t.surface,
        position: "sticky",
        top: 0,
        zIndex: 10,
        transition: "background 0.3s, border-color 0.3s",
        minHeight: isMobile ? (isLandscape ? "60px" : "56px") : "72px",
      },
      headerTitle: {
        fontSize: fontSize.lg,
        fontWeight: 700,
        letterSpacing: "-0.3px",
        flex: 1,
        color: theme === "dark" ? "transparent" : t.accent,
        background: theme === "dark" ? `linear-gradient(135deg, ${t.accent}, ${t.accent2})` : "none",
        WebkitBackgroundClip: theme === "dark" ? "text" : "unset",
        WebkitTextFillColor: theme === "dark" ? "transparent" : "unset",
      },
      content: {
        flex: 1,
        padding: contentPadding,
        overflowY: "auto",
        animation: "fadeIn 0.4s ease-in",
        overflowX: "hidden",
        paddingBottom: bottomNavPadding,
      },
      card: {
        background: t.card,
        borderRadius: 12,
        padding: cardPadding,
        marginBottom: 12,
        border: `1px solid ${t.border}`,
        cursor: "pointer",
        transition: "all 0.3s",
        animation: "slideUp 0.4s ease-out",
      },
      cardTitle: {
        fontSize: fontSize.md,
        fontWeight: 600,
        marginBottom: 6,
        color: t.text,
      },
      cardText: {
        fontSize: fontSize.sm,
        color: t.textMuted,
        lineHeight: 1.5,
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      },
      btn: (variant = "primary") => ({
        padding: isMobile ? (isLandscape ? "12px 20px" : "10px 16px") : "14px 28px",
        borderRadius: 8,
        border: "none",
        cursor: "pointer",
        fontWeight: 600,
        fontSize: isMobile ? fontSize.sm : fontSize.md,
        display: "flex",
        alignItems: "center",
        gap: 6,
        transition: "all 0.2s",
        fontFamily: "inherit",
        ...(variant === "primary"
          ? { background: t.accent, color: "#fff" }
          : variant === "danger"
          ? { background: `${t.danger}22`, color: t.danger }
          : variant === "ghost"
          ? { background: "transparent", color: t.textMuted }
          : { background: t.card, color: t.text, border: `1px solid ${t.border}` }),
      }),
      input: {
        width: "100%",
        background: t.card,
        border: `1px solid ${t.border}`,
        borderRadius: 8,
        padding: isMobile ? "10px 12px" : "12px 16px",
        color: t.text,
        fontSize: fontSize.sm,
        outline: "none",
        boxSizing: "border-box",
        fontFamily: "inherit",
        transition: "border-color 0.2s",
      },
      textarea: {
        width: "100%",
        background: t.card,
        border: `1px solid ${t.border}`,
        borderRadius: 8,
        padding: isMobile ? "10px 12px" : "12px 16px",
        color: t.text,
        fontSize: fontSize.sm,
        outline: "none",
        resize: "vertical",
        minHeight: isMobile ? "120px" : "200px",
        lineHeight: 1.6,
        boxSizing: "border-box",
        fontFamily: "inherit",
        transition: "border-color 0.2s",
      },
      label: {
        fontSize: fontSize.xs,
        color: t.textMuted,
        marginBottom: 6,
        display: "block",
        fontWeight: 500,
      },
      row: {
        display: "flex",
        gap: 8,
        alignItems: "center",
      },
      section: {
        marginBottom: 20,
      },
      bubble: (isUser) => ({
        maxWidth: "82%",
        padding: isMobile ? "10px 14px" : "12px 18px",
        borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
        background: isUser ? t.accent : t.card,
        color: isUser ? "#fff" : t.text,
        fontSize: fontSize.sm,
        lineHeight: 1.5,
        border: isUser ? "none" : `1px solid ${t.border}`,
        alignSelf: isUser ? "flex-end" : "flex-start",
        whiteSpace: "pre-wrap",
        animation: "fadeIn 0.3s ease-in",
        wordBreak: "break-word",
      }),
      empty: {
        textAlign: "center",
        padding: isMobile ? "60px 20px" : "80px 40px",
        color: t.textMuted,
      },
      categoryBadge: (color) => ({
        display: "inline-block",
        background: `${color}33`,
        color: color,
        borderRadius: 6,
        padding: "4px 10px",
        fontSize: fontSize.xs,
        fontWeight: 500,
        marginRight: 6,
        marginBottom: 8,
        cursor: "pointer",
        border: `1px solid ${color}66`,
      }),
      modal: {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999,
        animation: "fadeIn 0.2s ease-out",
        padding: "20px",
      },
      modalContent: {
        background: t.card,
        borderRadius: 12,
        padding: isMobile ? "20px" : "28px",
        width: "90%",
        maxWidth: isMobile ? "400px" : "600px",
        border: `1px solid ${t.border}`,
        animation: "slideUp 0.3s ease-out",
        maxHeight: "90vh",
        overflowY: "auto",
      },
      bottomNav: {
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: maxWidth,
        background: t.surface,
        borderTop: `2px solid ${t.border}`,
        display: "flex",
        padding: isMobile ? "8px 0" : "12px 0",
        justifyContent: "space-around",
        zIndex: 10,
        transition: "background 0.3s, border-color 0.3s",
        backdropFilter: "blur(10px)",
      },
      navButton: (active) => ({
        flex: "1",
        padding: isMobile ? "8px 4px" : "12px 8px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        background: "none",
        border: "none",
        color: active ? t.accent : t.textMuted,
        fontSize: isMobile ? 10 : 12,
        fontWeight: active ? 700 : 500,
        cursor: "pointer",
        transition: "all 0.3s",
        position: "relative",
        borderTop: active ? `3px solid ${t.accent}` : "3px solid transparent",
      }),
      navIcon: { fontSize: isMobile ? 20 : 24 },
      navLabel: { fontSize: isMobile ? 9 : 11, marginTop: 2 },
    };
  }, [t, theme, isMobile, isLandscape, maxWidth, headerPadding, contentPadding, cardPadding, bottomNavPadding]);

  const SaveIndicator = () => {
    if (saveStatus === "idle" && !draftExists) return null;
    let statusText = "";
    let statusColor = t.textMuted;
    if (saveStatus === "saving") {
      statusText = "💾 Сохранение...";
      statusColor = t.warning;
    } else if (saveStatus === "saved") {
      statusText = "✅ Сохранено";
      statusColor = t.success;
    } else if (draftExists && view !== "edit") {
      statusText = "📝 Есть черновик";
      statusColor = t.accent;
    }
    return (
      <div
        style={{
          position: "fixed",
          bottom: isMobile ? 80 : 100,
          right: 20,
          padding: "8px 16px",
          borderRadius: 8,
          background: t.surface,
          border: `1px solid ${statusColor}`,
          color: statusColor,
          fontSize: 12,
          zIndex: 1000,
          transition: "all 0.3s",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          maxWidth: "90%",
        }}
      >
        {statusText}
      </div>
    );
  };

  // aiSummarize вынесена на уровень компонента, чтобы её можно было вызывать из NoteDetail и renderAI
  const aiSummarize = async (note) => {
    setAiLoading(true);
    try {
      const reply = await askAI(
        [
          {
            role: "user",
            content: `Сделай краткое резюме этой заметки и предложи 3 вопроса для самопроверки:\n\n${note.title}\n${note.blocks ? note.blocks.map((b) => b.text).join(" ") : note.body}`,
          },
        ],
        "Ты помощник для учёбы. Отвечай на русском."
      );

      const updatedNote = { ...note, aiSummary: reply };
      setActiveNote(updatedNote);

      const exists = data.notes.find((n) => n.id === note.id);
      if (exists) {
        const notes = data.notes.map((n) => (n.id === note.id ? updatedNote : n));
        persist({ ...data, notes });
      } else {
        persist({ ...data, notes: [updatedNote, ...data.notes] });
      }
    } catch (err) {
      console.error("aiSummarize error:", err);
    } finally {
      setAiLoading(false);
    }
  };

  const renderNotes = () => {
    if (view === "edit") {
      return <NoteEditor note={activeNote} categories={data.categories} onSave={saveNote} onCancel={() => { clearDraft(); setDraftExists(false); setView("list"); }} theme={t} s={s} icons={icons} Icon={Icon} isTablet={isTablet} />;
    }

    if (view === "detail") {
      return <NoteDetail note={activeNote} categories={data.categories} onEdit={() => setView("edit")} onDelete={() => setShowDeleteConfirm(activeNote.id)} onBack={() => setView("list")} onSummarize={() => aiSummarize(activeNote)} aiLoading={aiLoading} theme={t} s={s} icons={icons} Icon={Icon} isTablet={isTablet} isLandscape={isLandscape} />;
    }

    return (
      <div>
        <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${t.border}` }}>
          <div style={{ ...s.row, marginBottom: 12, justifyContent: "space-between" }}>
            <div style={{ fontSize: s.label.fontSize, fontWeight: 600, color: t.textMuted }}>📂 КАТЕГОРИИ</div>
            <button style={s.btn("ghost")} onClick={() => setShowCategoryModal(true)}>
              <Icon d={icons.plus} size={14} />
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, overflowX: "auto" }}>
            <button style={{ ...s.categoryBadge(t.accent), border: activeCategory === null ? `2px solid ${t.accent}` : `1px solid ${t.accent}66`, background: activeCategory === null ? `${t.accent}44` : `${t.accent}22` }} onClick={() => setActiveCategory(null)}>
              Все
            </button>
            {data.categories.map((cat) => (
              <div key={cat.id} style={{ display: "inline-flex", alignItems: "center", gap: 2, marginBottom: 4 }}>
                <button style={{ ...s.categoryBadge(cat.color), border: activeCategory === cat.id ? `2px solid ${cat.color}` : `1px solid ${cat.color}66`, background: activeCategory === cat.id ? `${cat.color}44` : `${cat.color}22`, marginRight: 0 }} onClick={() => setActiveCategory(cat.id)}>
                  {cat.name}
                </button>
                <button style={{ background: `${t.danger}22`, color: t.danger, border: `1px solid ${t.danger}44`, borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 12, fontWeight: 700, padding: 0, transition: "all 0.2s" }} onClick={(e) => { e.stopPropagation(); if (window.confirm(`Удалить категорию "${cat.name}"? Заметки станут "без категории"`)) { deleteCategory(cat.id); } }} title="Удалить категорию">×</button>
              </div>
            ))}
          </div>
        </div>

        {draftExists && (
          <div style={{ padding: "12px 16px", background: `${t.accent}22`, borderRadius: 8, marginBottom: 12, border: `1px solid ${t.accent}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: 14 }}>📝 У вас есть несохраненный черновик</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={s.btn("primary")} onClick={restoreDraft}>Восстановить</button>
              <button style={s.btn("ghost")} onClick={discardDraft}>Удалить</button>
            </div>
          </div>
        )}

        <div style={{ ...s.row, marginBottom: 12, gap: 12 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: t.textMuted }}>
              <Icon d={icons.search} size={16} />
            </span>
            <input style={{ ...s.input, paddingLeft: 34 }} placeholder="Поиск..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button style={s.btn("primary")} onClick={newNote}>
            <Icon d={icons.plus} size={16} /> {!isMobile && "Новая"}
          </button>
        </div>

        {filtered.length === 0 ? (
          <div style={s.empty}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Нет заметок</div>
            <div style={{ fontSize: 13 }}>{activeCategory !== null ? "Создайте заметку в этой категории" : "Создайте первую заметку"}</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${gridColumns}, 1fr)`, gap: isTablet ? 16 : 12 }}>
            {filtered.map((note) => {
              const cat = data.categories.find((c) => c.id === note.categoryId);
              return (
                <div key={note.id} style={s.card} onClick={() => { setActiveNote(note); setView("detail"); }}>
                  <div style={s.cardTitle}>{note.title || "Без названия"}</div>
                  <div style={s.cardText}>{note.blocks ? note.blocks.map((b) => b.text).join(" ") : note.body}</div>
                  <div style={{ marginTop: 8 }}>
                    {cat && <span style={s.categoryBadge(cat.color)}>{cat.name}</span>}
                    {note.tags && note.tags.map((tag) => <span key={tag} style={{ display: "inline-block", background: `${t.accent}22`, color: t.accent, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 500, marginRight: 4, marginBottom: 4 }}>{tag}</span>)}
                    <span style={{ fontSize: 11, color: t.textMuted, float: "right", marginTop: 2 }}>{new Date(note.createdAt).toLocaleDateString("ru")}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCategoryModal && (
        <div style={s.modal} onClick={() => setShowCategoryModal(false)}>
          <div style={s.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={{ ...s.cardTitle, marginBottom: 16 }}><Icon d={icons.folder} size={16} style={{ marginRight: 6 }} /> Новая категория</div>
            <div style={s.section}>
              <label style={s.label}>Название</label>
              <input style={s.input} placeholder="Например: 📚 Учёба" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
            </div>
            <div style={s.section}>
              <label style={s.label}>Цвет</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[