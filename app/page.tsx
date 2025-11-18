/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Playfair_Display } from "next/font/google";

// Dynamic import for monaco editor (no SSR)
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
});

// Custom Font
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

// Key components of the Problem
type Problem = {
  title: string;
  titleSlug: string;
  difficulty: string;
  frontendId?: string;
  content?: string;
  codeSnippets?: { code: string; lang: string; langSlug: string }[];
  topicTags?: { name: string; slug?: string }[];
  [k: string]: any;
};

// Key components of the Chat Message
type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  time?: string;
};

export default function Home() {
  // Picker state
  const [jsonText, setJsonText] = useState("");
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selected, setSelected] = useState<Problem | null>(null);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [username, setUsername] = useState("");
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // Chat/Interview
  const [mode, setMode] = useState<"picker" | "interview">("picker");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const [lastUserMessageTime, setLastUserMessageTime] = useState<number | null>(
    null
  );
  const [hintSent, setHintSent] = useState(false);

  // Workspace tabs
  const [activeTab, setActiveTab] = useState<
    "editor" | "notes" | "timer" | "problem"
  >("editor");

  // Monaco editor content + language
  const [editorValue, setEditorValue] = useState<string>("");
  const [editorLanguage, setEditorLanguage] = useState<string>("Java");
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);

  // Notes content
  const [notes, setNotes] = useState<string>("");

  // Timer (persistent)
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [originalDuration, setOriginalDuration] = useState<number | null>(null);
  const [blinking, setBlinking] = useState(false);

  const uid = (s = "") =>
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${s}`;

  // Pagination
  const totalPages = Math.max(1, Math.ceil(problems.length / pageSize));

  const paginatedProblems = problems.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Helper: extract solved problems
  const extractSolvedProblems = (data: any): Problem[] => {
    try {
      const questions = data?.data?.userProgressQuestionList?.questions;
      if (!Array.isArray(questions)) return [];
      return questions
        .filter((q: any) => q.questionStatus === "SOLVED")
        .map((q: any) => ({
          title: q.title || q.translatedTitle || "Unknown",
          titleSlug: q.titleSlug || "",
          difficulty: q.difficulty || "Unknown",
          frontendId: q.frontendId || q.questionFrontendId,
          codeSnippets: q.codeSnippets || q.code_snippets || [],
          topicTags: q.topicTags || q.topic_tags || [],
          content: q.content || q.translatedContent || "",
          ...q,
        }));
    } catch {
      return [];
    }
  };

  // Process pasted JSON
  const handleProcess = () => {
    setError("");
    try {
      const parsed = JSON.parse(jsonText);
      const solved = extractSolvedProblems(parsed);
      if (!solved.length) {
        setError(
          "No solved problems found. Paste the full userProgressQuestionList JSON."
        );
        return;
      }
      setProblems(solved);
      setSelected(solved[Math.floor(Math.random() * solved.length)]);
    } catch {
      setError("Invalid JSON.");
    }
  };

  const pickRandom = () => {
    if (!problems.length) return;
    setSelected(problems[Math.floor(Math.random() * problems.length)]);
  };

  useEffect(() => {
    const saved = localStorage.getItem("leetcodeUsername");
    if (saved) {
      setUsername(saved);
    } else {
      setShowUsernameModal(true);
    }
  }, []);

  // Per-problem persistence: editor & notes
  useEffect(() => {
    if (!selected) return;

    const keyEditor = `editor:${selected.titleSlug}`;
    const keyNotes = `notes:${selected.titleSlug}`;

    const savedEditor = localStorage.getItem(keyEditor);
    if (savedEditor !== null) setEditorValue(savedEditor);

    const savedNotes = localStorage.getItem(keyNotes);
    if (savedNotes !== null) setNotes(savedNotes);

    // populate availableLanguages from snippets and choose default snippet
    const snippets = selected.codeSnippets ?? [];
    const langs = snippets
      .map((s) => s.langSlug?.toLowerCase() ?? s.lang?.toLowerCase())
      .filter(Boolean);
    if (langs.length) {
      const mapped = Array.from(new Set(langs.map(mapLangSlugToMonaco)));
      setAvailableLanguages(mapped);
      // if editor empty, pick first best snippet
      if ((!savedEditor || savedEditor.trim() === "") && snippets.length) {
        const priority = [
          "Python3",
          "Python",
          "Javascript",
          "Typescript",
          "CPP",
          "C",
          "Java",
        ];
        const snippet =
          snippets.find((s) =>
            priority.includes((s.langSlug ?? "").toLowerCase())
          ) ?? snippets[0];
        if (snippet) {
          setEditorValue(snippet.code ?? "");
          setEditorLanguage(mapLangSlugToMonaco(snippet.langSlug));
        }
      } else {
        // pick existing editor language or first available
        if (!availableLanguages.length) setEditorLanguage(mapped[0]);
      }
    } else {
      // no snippets -> fallback languages
      setAvailableLanguages(["Javascript", "Python", "CPP", "Java", "C"]);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // persist editor and notes when they change
  useEffect(() => {
    if (!selected) return;
    localStorage.setItem(`editor:${selected.titleSlug}`, editorValue);
  }, [editorValue, selected]);

  useEffect(() => {
    if (!selected) return;
    localStorage.setItem(`notes:${selected.titleSlug}`, notes);
  }, [notes, selected]);

  // Timer persistence (global)
  useEffect(() => {
    try {
      const savedRaw = localStorage.getItem("timerState");
      if (!savedRaw) return;
      const saved = JSON.parse(savedRaw || "{}");

      if (typeof saved.timeLeft === "number") setTimeLeft(saved.timeLeft);
      if (typeof saved.timerRunning === "boolean")
        setTimerRunning(saved.timerRunning);
      if (typeof saved.originalDuration === "number")
        setOriginalDuration(saved.originalDuration);

      // adjust by elapsed time only if it was running
      if (
        saved.lastUpdated &&
        saved.timerRunning &&
        typeof saved.timeLeft === "number"
      ) {
        const diff = Math.floor((Date.now() - saved.lastUpdated) / 1000);
        const newTime = Math.max(0, saved.timeLeft - diff);
        setTimeLeft(newTime);
        if (newTime === 0) {
          setTimerRunning(false);
          setTimeout(() => handleTimerEnd(), 200);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "timerState",
      JSON.stringify({
        timeLeft,
        timerRunning,
        originalDuration,
        lastUpdated: Date.now(),
      })
    );
  }, [timeLeft, timerRunning, originalDuration]);

  // Timer end behavior
  const handleTimerEnd = () => {
    try {
      const audio = new Audio("/timer-end.mp3");
      audio.play().catch(() => {});
    } catch (e) {}

    setBlinking(true);
    setTimeout(() => alert("⏰ Time's up!"), 300);
    setTimeout(() => setBlinking(false), 5000);
  };

  useEffect(() => {
    if (!timerRunning || timeLeft === null) return;
    if (timeLeft <= 0) {
      setTimerRunning(false);
      setTimeLeft(0);
      handleTimerEnd();
      return;
    }
    const interval = setInterval(() => {
      setTimeLeft((t) => (t !== null ? t - 1 : null));
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning, timeLeft]);

  // helpers for starting durations (sets originalDuration so Restart uses it)
  const startWithDuration = (seconds: number) => {
    setOriginalDuration(seconds);
    setTimeLeft(seconds);
    setTimerRunning(true);
    setBlinking(false);
  };

  const restartTimer = () => {
    if (originalDuration) {
      setTimeLeft(originalDuration);
      setTimerRunning(true);
      setBlinking(false);
    } else {
      setOriginalDuration(30 * 60);
      setTimeLeft(30 * 60);
      setTimerRunning(true);
      setBlinking(false);
    }
  };

  const resetTimer = () => {
    setTimerRunning(false);
    setTimeLeft(null);
    setOriginalDuration(null);
    setBlinking(false);
    localStorage.removeItem("timerState");
  };

  // Monaco language mapping helper
  function mapLangSlugToMonaco(langSlug?: string) {
    if (!langSlug) return "javascript";
    const s = langSlug.toLowerCase();
    if (s.includes("Python")) return "python";
    if (s.includes("Javascript")) return "javascript";
    if (s.includes("Typescript")) return "typescript";
    if (s.includes("CPP") || s.includes("c++")) return "cpp";
    if (s === "C") return "c";
    if (s === "Java") return "java";
    if (s === "csharp") return "csharp";
    if (s === "golang" || s === "go") return "go";
    if (s === "rust") return "rust";
    return "java";
  }

  // Chat scrolling
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, mode]);

  // Interview start: assistant initiates chat
  const startInterview = () => {
    if (!selected) {
      setError("Select a problem first.");
      return;
    }
    setMode("interview");

    // assistant welcome message (interviewer initiating)
    const welcome: ChatMessage = {
      id: uid("assistant"),
      role: "assistant",
      text: `Hi, we'll do a FAANG-style mock interview for "${selected.title}". First, briefly explain your approach to solve this problem.`,
      time: new Date().toISOString(),
    };
    setMessages([welcome]);

    // open workspace editor automatically
    setActiveTab("editor");
  };

  useEffect(() => {
    if (mode !== "interview") return;
    if (!selected) return;

    const interval = setInterval(() => {
      if (!lastUserMessageTime) return;

      const now = Date.now();
      const diff = (now - lastUserMessageTime) / 1000;

      const INACTIVITY_LIMIT = 60;

      if (diff > INACTIVITY_LIMIT && !hintSent) {
        setHintSent(true);
        triggerAutoHint();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [lastUserMessageTime, hintSent, mode, selected]);

  const triggerAutoHint = async () => {
    if (!selected) return;

    const assistantMessage: ChatMessage = {
      id: uid("assistant"),
      role: "assistant",
      text: "",
      time: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const response = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages.map((m) => ({ role: m.role, content: m.text })),
          problem: selected,
          autoHint: true,
        }),
      });

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessage.id ? { ...m, text: accumulated } : m
          )
        );
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Streaming Chat
  const sendMessage = async (userText: string) => {
    if (!userText.trim()) return;

    const userMessage: ChatMessage = {
      id: uid("user"),
      role: "user",
      text: userText,
      time: new Date().toISOString(),
    };

    setLastUserMessageTime(Date.now());
    setHintSent(false);

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setSending(true);

    const apiMessages = messages
      .concat(userMessage)
      .map((m) => ({ role: m.role, content: m.text }));

    const assistantMessage: ChatMessage = {
      id: uid("assistant"),
      role: "assistant",
      text: "",
      time: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const response = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          problem: selected,
          autoHint: false,
        }),
      });

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessage.id ? { ...m, text: accumulated } : m
          )
        );
      }
    } catch (e) {
      console.error(e);
      setMessages((prev) => [
        ...prev,
        {
          id: uid("assistant"),
          role: "assistant",
          text: "⚠️ Streaming error.",
          time: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  // UI components
  const ChatBubble = ({ m }: { m: ChatMessage }) =>
    m.role === "assistant" ? (
      <div className="mb-3">
        <div className="inline-block bg-white p-3 rounded-lg border max-w-[80%]">
          <div className="text-sm whitespace-pre-wrap">{m.text}</div>
          <div className="text-xs text-gray-500 mt-2">
            {new Date(m.time || "").toLocaleTimeString()}
          </div>
        </div>
      </div>
    ) : (
      <div className="mb-3 flex justify-end">
        <div className="inline-block bg-blue-600 text-white p-3 rounded-lg max-w-[80%]">
          <div className="text-sm whitespace-pre-wrap">{m.text}</div>
          <div className="text-xs text-white/80 mt-2 text-right">
            {new Date(m.time || "").toLocaleTimeString()}
          </div>
        </div>
      </div>
    );

  // load snippet into editor
  const loadSnippetToEditor = (snippet: { code: string; langSlug: string }) => {
    setEditorValue(snippet.code);
    setEditorLanguage(mapLangSlugToMonaco(snippet.langSlug));
    setActiveTab("editor");
  };

  const clearEditorDraft = () => {
    if (!selected) return;
    setEditorValue("");
    localStorage.removeItem(`editor:${selected.titleSlug}`);
  };

  // when user selects a language from dropdown, just set editorLanguage
  const handleLanguageSelect = (lang: string) => {
    setEditorLanguage(lang);
  };

  const submitSolution = () => {
    if (!editorValue.trim()) return;

    const formatted =
      "Here is my submitted solution:\n\n```" +
      editorLanguage.toLowerCase() +
      "\n" +
      editorValue +
      "\n```";

    sendMessage(formatted);
  };

  // Render
  return (
    <>
      <style jsx global>{`
        @keyframes blink-red {
          0% {
            background-color: #ffffff;
          }
          50% {
            background-color: #ffe6e6;
          }
          100% {
            background-color: #ffffff;
          }
        }
        .blink-red {
          animation: blink-red 0.7s ease-in-out infinite;
        }
        .tab-active {
          border-bottom: 2px solid #1a73e8;
          font-weight: 600;
        }
        /* small timer pill */
        .timer-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid #e5e7eb;
          background: #ffffff;
          font-weight: 600;
        }
      `}</style>

      <div className="p-8 min-h-screen bg-[#F7F7F7] text-[#1E1E1E]">
        <div className="max-w-7xl mx-auto">
          <header className="mb-8 relative">
            <h1
              className={`${playfair.className} text-3xl font-semibold text-center`}
            >
              LeetCode Mock Interview
            </h1>
            <div className="mt-3 flex items-center justify-center gap-2">
              <div className="w-12 h-[1px] bg-gray-300" />
              <div className="w-2 h-2 bg-[#FFA116] rounded-full" />
              <div className="w-12 h-[1px] bg-gray-300" />
            </div>
            <div className="absolute right-8 top-8 text-sm text-gray-700">
              {username && (
                <div className="px-3 py-1 border rounded-full bg-white shadow-sm">
                  {username}
                </div>
              )}
            </div>
          </header>

          {/* Picker */}
          {mode === "picker" && (
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-7">
                <div className="p-6 bg-white rounded-xl shadow-sm border">
                  <div className="flex items-center justify-between mb-2">
                    <label className="font-medium">
                      Paste LeetCode Progress JSON
                    </label>

                    {/* Guide button */}
                    <button
                      onClick={() => setShowGuide(true)}
                      className="flex items-center gap-1 text-sm px-3 py-1 border rounded-lg bg-white hover:bg-gray-50"
                    >
                      📝 Guide
                    </button>
                  </div>
                  <textarea
                    className="w-full h-48 p-3 border rounded-lg"
                    value={jsonText}
                    onChange={(e) => setJsonText(e.target.value)}
                  />
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={handleProcess}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                    >
                      Process
                    </button>
                    <button
                      onClick={pickRandom}
                      className="px-4 py-2 bg-white border rounded-lg"
                    >
                      Random
                    </button>
                    <button
                      onClick={() => {
                        setJsonText("");
                        setProblems([]);
                        setSelected(null);
                      }}
                      className="px-4 py-2 bg-white border rounded-lg"
                    >
                      Reset
                    </button>
                  </div>
                  {error && <p className="text-red-600 mt-3">{error}</p>}
                </div>

                {selected && (
                  <div className="mt-6 p-6 bg-white rounded-xl shadow-sm border flex justify-between items-center">
                    <div>
                      <div className="text-lg font-medium">
                        {selected.title}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        Difficulty: {selected.difficulty}
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={startInterview}
                        className="px-4 py-2 bg-orange-500 text-white rounded-lg"
                      >
                        Start Interview
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <aside className="col-span-5">
                <div className="p-6 bg-white rounded-xl shadow-sm border">
                  <h3 className="font-medium mb-3">
                    Solved Problems ({problems.length})
                  </h3>

                  {/* Problems List */}
                  <div className="max-h-[420px] overflow-auto mb-4">
                    {paginatedProblems.map((p) => (
                      <div
                        key={p.titleSlug}
                        className={`p-3 mb-2 rounded-lg border ${
                          selected?.titleSlug === p.titleSlug
                            ? "border-blue-600"
                            : "border-gray-300"
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-sm">{p.title}</div>
                            <div className="text-xs text-gray-600">
                              #{p.frontendId} · {p.difficulty}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            <button
                              onClick={() => setSelected(p)}
                              className="text-blue-600 text-sm"
                            >
                              Select
                            </button>
                            <button
                              onClick={() => {
                                setSelected(p);
                                setActiveTab("problem");
                                setMode("picker");
                              }}
                              className="text-sm text-gray-600"
                            >
                              View
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination Controls — moved down */}
                  <div className="flex justify-between items-center">
                    {/* Page Size Dropdown */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Show:</span>
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="border rounded px-2 py-1 text-sm"
                      >
                        {[5, 10, 50, 100].map((size) => (
                          <option key={size} value={size}>
                            {size}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Pagination Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => p - 1)}
                        className={`px-2 py-1 border rounded text-sm ${
                          currentPage === 1
                            ? "opacity-40 cursor-not-allowed"
                            : "hover:bg-gray-100"
                        }`}
                      >
                        Prev
                      </button>

                      <span className="text-sm text-gray-600">
                        {currentPage} / {totalPages}
                      </span>

                      <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage((p) => p + 1)}
                        className={`px-2 py-1 border rounded text-sm ${
                          currentPage === totalPages
                            ? "opacity-40 cursor-not-allowed"
                            : "hover:bg-gray-100"
                        }`}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          )}

          {/* Interview mode + Tabbed Workspace */}
          {mode === "interview" && selected && (
            <div className="grid grid-cols-12 gap-6">
              {/* Left: Chat */}
              <div className="col-span-8">
                <div className="h-[70vh] p-4 bg-white rounded-xl shadow-sm border flex flex-col">
                  <div className="border-b pb-2 mb-2 flex items-center justify-between">
                    <div>
                      <div className="text-lg font-medium">
                        {selected.title}
                      </div>
                      <div className="text-sm text-gray-600">
                        Difficulty: {selected.difficulty}
                      </div>
                    </div>
                    {/* show small running timer pill in chat header if timer is active */}
                    <div>
                      {timeLeft !== null && (
                        <div className="timer-pill">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8v4l3 3"
                            />
                          </svg>
                          <div>
                            {String(Math.floor(timeLeft / 60)).padStart(2, "0")}
                            :{String(timeLeft % 60).padStart(2, "0")}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    ref={chatScrollRef}
                    className="flex-1 overflow-auto px-1"
                  >
                    {messages.map((m) => (
                      <ChatBubble key={m.id} m={m} />
                    ))}
                  </div>

                  <form
                    className="mt-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      sendMessage(input);
                    }}
                  >
                    <div className="flex gap-3">
                      <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        className="flex-1 p-3 border rounded-lg"
                        placeholder="Your answer..."
                      />
                      <button
                        disabled={sending}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                      >
                        Send
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Right: Tabbed Workspace */}
              <div className="col-span-4">
                <div
                  className={`h-[70vh] p-0 rounded-xl shadow-sm border overflow-hidden ${
                    blinking ? "blink-red" : "bg-white"
                  }`}
                >
                  {/* Tabs header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b">
                    <div className="flex gap-3">
                      <button
                        className={`px-3 py-1 ${
                          activeTab === "editor"
                            ? "tab-active"
                            : "text-gray-600"
                        }`}
                        onClick={() => setActiveTab("editor")}
                      >
                        Editor
                      </button>
                      <button
                        className={`px-3 py-1 ${
                          activeTab === "notes" ? "tab-active" : "text-gray-600"
                        }`}
                        onClick={() => setActiveTab("notes")}
                      >
                        Notes
                      </button>
                      <button
                        className={`px-3 py-1 ${
                          activeTab === "timer" ? "tab-active" : "text-gray-600"
                        }`}
                        onClick={() => setActiveTab("timer")}
                      >
                        Timer
                      </button>
                      <button
                        className={`px-3 py-1 ${
                          activeTab === "problem"
                            ? "tab-active"
                            : "text-gray-600"
                        }`}
                        onClick={() => setActiveTab("problem")}
                      >
                        Problem
                      </button>
                    </div>

                    <div>
                      <button
                        onClick={() => {
                          setMode("picker");
                          setMessages([]);
                          resetTimer();
                        }}
                        className="px-2 py-1 border rounded"
                      >
                        Back
                      </button>
                    </div>
                  </div>

                  {/* Tab content area */}
                  <div className="p-4 h-[calc(70vh-64px)] overflow-auto">
                    {/* Editor Tab */}
                    {activeTab === "editor" && (
                      <div className="flex flex-col h-full">
                        {/* Header Row */}
                        <div className="flex items-center justify-between mb-2">
                          {/* Left → Language selector */}
                          <div>
                            <select
                              value={editorLanguage}
                              onChange={(e) =>
                                handleLanguageSelect(e.target.value)
                              }
                              className="px-2 py-1 border rounded text-sm"
                            >
                              {availableLanguages.map((lang) => (
                                <option key={lang} value={lang}>
                                  {lang}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Right → Clear + Open on LeetCode */}
                          <div className="flex gap-2">
                            <button
                              onClick={clearEditorDraft}
                              className="text-xs px-2 py-1 border rounded"
                            >
                              Clear
                            </button>

                            <a
                              href={`https://leetcode.com/problems/${selected.titleSlug}/`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs px-2 py-1 border rounded"
                            >
                              Open on LeetCode
                            </a>
                          </div>
                        </div>

                        {/* Monaco Editor */}
                        <div className="flex-1 border rounded overflow-hidden">
                          <MonacoEditor
                            theme="vs-light"
                            defaultLanguage={editorLanguage}
                            language={editorLanguage}
                            value={editorValue}
                            onChange={(val) => setEditorValue(val ?? "")}
                            options={{
                              minimap: { enabled: false },
                              fontSize: 13,
                              automaticLayout: true,
                              scrollBeyondLastLine: false,
                            }}
                          />
                        </div>

                        {/* Footer row */}
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            onClick={() => {}}
                            className="px-3 py-1 border rounded"
                          >
                            Run
                          </button>
                          <button
                            onClick={submitSolution}
                            className="px-3 py-1 border rounded bg-[#FFA116] text-white hover:opacity-90"
                          >
                            Submit
                          </button>

                          <div className="text-xs text-gray-500 ml-auto">
                            Saved automatically
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Notes Tab */}
                    {activeTab === "notes" && (
                      <div className="flex flex-col h-full">
                        <div className="text-sm font-medium mb-2">
                          Notes: {selected.title}
                        </div>
                        <textarea
                          className="flex-1 p-3 border rounded resize-none"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Write your notes / pseudocode here. Saved automatically per problem."
                        />
                        <div className="mt-2 text-xs text-gray-500">
                          Notes saved to localStorage for this problem.
                        </div>
                      </div>
                    )}

                    {/* Timer Tab */}
                    {activeTab === "timer" && (
                      <div>
                        <div className="text-sm font-medium mb-2">Timer</div>

                        <div className="flex gap-2 items-center mb-3">
                          <button
                            onClick={() => startWithDuration(30 * 60)}
                            className="px-3 py-1 border rounded"
                          >
                            Start 30m
                          </button>
                          <button
                            onClick={() => startWithDuration(45 * 60)}
                            className="px-3 py-1 border rounded"
                          >
                            Start 45m
                          </button>
                          {timerRunning ? (
                            <button
                              onClick={() => setTimerRunning(false)}
                              className="px-3 py-1 border border-red-400 text-red-600 rounded"
                            >
                              Pause
                            </button>
                          ) : (
                            timeLeft !== null &&
                            timeLeft > 0 && (
                              <button
                                onClick={() => setTimerRunning(true)}
                                className="px-3 py-1 border border-green-500 text-green-600 rounded"
                              >
                                Resume
                              </button>
                            )
                          )}
                          {originalDuration !== null && (
                            <button
                              onClick={restartTimer}
                              className="px-3 py-1 border rounded"
                            >
                              Restart
                            </button>
                          )}
                          {(timeLeft !== null || originalDuration !== null) && (
                            <button
                              onClick={resetTimer}
                              className="px-3 py-1 border rounded"
                            >
                              Reset
                            </button>
                          )}
                        </div>

                        <div className="mb-2 text-lg font-medium">
                          {timeLeft !== null
                            ? `${String(Math.floor(timeLeft / 60)).padStart(
                                2,
                                "0"
                              )}:${String(timeLeft % 60).padStart(2, "0")}`
                            : "--:--"}
                        </div>

                        <div className="text-xs text-gray-500">
                          Timer persists across refresh / navigation.
                        </div>
                      </div>
                    )}

                    {/* Problem Tab */}
                    {activeTab === "problem" && (
                      <div>
                        <div className="text-sm font-medium mb-2">
                          Problem — {selected.title}
                        </div>

                        <div className="text-xs text-gray-600 mb-3">
                          Difficulty: {selected.difficulty} · ID:{" "}
                          {selected.frontendId}
                        </div>

                        {/* tags as badges */}
                        <div className="mb-3 flex flex-wrap gap-2">
                          {(selected.topicTags || []).map((t, i) => (
                            <div
                              key={i}
                              className="text-xs px-2 py-1 bg-gray-100 rounded-full border text-gray-700"
                            >
                              {t.name}
                            </div>
                          ))}
                        </div>

                        {/* content (may be HTML) */}
                        <div
                          className="prose max-w-none mb-3"
                          dangerouslySetInnerHTML={{
                            __html:
                              selected.content || "<i>No content provided</i>",
                          }}
                        />

                        {/* code snippets */}
                        <div className="mb-2">
                          <div className="text-sm font-medium mb-1">
                            Starter snippets
                          </div>
                          <div className="flex flex-col gap-2">
                            {(selected.codeSnippets || []).map((s, idx) => (
                              <div key={idx} className="flex items-start gap-2">
                                <div className="flex-1 text-xs">
                                  <div className="font-medium">{s.lang}</div>
                                  <div className="text-gray-600 truncate max-w-[16rem]">
                                    {(s.code || "").split("\n")[0] ?? ""}
                                  </div>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <button
                                    onClick={() => loadSnippetToEditor(s)}
                                    className="px-2 py-1 text-xs border rounded"
                                  >
                                    Load
                                  </button>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard?.writeText(s.code);
                                    }}
                                    className="px-2 py-1 text-xs border rounded"
                                  >
                                    Copy
                                  </button>
                                </div>
                              </div>
                            ))}
                            {(selected.codeSnippets || []).length === 0 && (
                              <div className="text-xs text-gray-500">
                                No snippets available.
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 text-xs text-gray-500">
                          You can load any snippet into Editor tab.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Username Modal */}
      {showUsernameModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-80 border shadow-lg text-[#1E1E1E]">
            <h2 className="text-lg font-semibold mb-3 text-[#1E1E1E]">
              LeetCode Username
            </h2>

            <p className="text-sm text-gray-700 mb-3">
              Enter your LeetCode username so we can personalize your workspace.
            </p>

            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border p-2 rounded mb-4 text-[#1E1E1E]"
              placeholder="e.g. john_doe"
            />

            <button
              onClick={() => {
                if (username.trim()) {
                  localStorage.setItem("leetcodeUsername", username.trim());
                  setShowUsernameModal(false);
                }
              }}
              className="w-full bg-blue-600 text-white py-2 rounded-lg"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Guide Modal */}
      {showGuide && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-[420px] border shadow-lg text-[#1E1E1E]">
            <h2 className="text-lg font-semibold mb-3 text-[#1E1E1E]">
              How to fetch LeetCode JSON
            </h2>

            <ol className="text-sm text-gray-700 list-decimal ml-4 space-y-2">
              <li>
                Go to{" "}
                <span className="font-semibold">leetcode.com/progress</span>.
              </li>
              <li>
                Open{" "}
                <span className="font-semibold">Developer Tools → Network</span>
                .
              </li>
              <li>
                Refresh the page and click the request named
                <span className="font-semibold"> userProgressQuestionList</span>
                .
              </li>
              <li>
                Inside the <span className="font-semibold">Response</span> tab,
                copy the full JSON and paste it here.
              </li>
            </ol>

            <button
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full bg-blue-600 text-white py-2 rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
