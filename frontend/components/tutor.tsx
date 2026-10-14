"use client";
import { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Plus,
  Search,
  Send,
  Copy,
  Trash2,
  ShieldCheck,
  MessageSquare,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { Pick, Citation, Modal } from "@/components/study-ui";
import { Message, Material } from "@/lib/demo";
import { api } from "@/lib/api-client";
type Chat = {
  id: string;
  title: string;
  messages: Message[];
  courseId?: string;
  course?: string;
};
export function Tutor({
  courses,
  course,
  setCourse,
  materials,
  source,
  aiAvailable,
  revision,
}: {
  courses: string[];
  course: string;
  setCourse: (v: string) => void;
  materials: Material[];
  source: (p: any) => void;
  aiAvailable: boolean;
  revision: number;
}) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [active, setActive] = useState("");
  const [search, setSearch] = useState("");
  const [input, setInput] = useState("");
  const [style, setStyle] = useState("Simple");
  const [material, setMaterial] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const chat = chats.find((c) => c.id === active);
  async function history() {
    try {
      const cs = await api("conversations");
      setChats(cs);
      setActive((a) => (cs.some((c: Chat) => c.id === a) ? a : ""));
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    history();
  }, [revision]);
  useEffect(() => {
    if (chat?.course && chat.course !== course) setActive("");
    if (!materials.some((m) => m.id === material && m.course === course && m.status === "Ready to study"))
      setMaterial(
        materials.find(
          (m) => m.course === course && m.status === "Ready to study",
        )?.id || "",
      );
  }, [course, materials]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [chat?.messages.length, busy]);
  async function ask(text = input) {
    if (!text.trim() || busy || !aiAvailable || !material) return;
    setBusy(true);
    setError("");
    try {
      const answer = await api("chat", "POST", {
        course,
        materialId: material,
        ...(active ? { conversationId: active } : {}),
        question: text,
        style,
      });
      await history();
      setActive(answer.conversationId);
      setInput("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!active) return;
    setBusy(true);
    try {
      await api("conversations/" + active, "DELETE");
      await history();
      setActive("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const list = (
    <>
      {chats
        .filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))
        .map((c) => (
          <button
            className={`history-item ${active === c.id ? "active" : ""}`}
            disabled={busy}
            key={c.id}
            onClick={() => {
              if (c.course) setCourse(c.course);
              setActive(c.id);
              setShowHistory(false);
            }}
          >
            <MessageSquare size={16} />
            {c.title}
          </button>
        ))}
    </>
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">UNDERSTAND, ONE QUESTION AT A TIME</div>
          <h1>Your AI tutor</h1>
          <p>Learn with your material open beside you.</p>
        </div>
        <span className={`badge ${aiAvailable ? "green" : "amber"}`}>
          {aiAvailable
            ? "Gemini configured"
            : "AI unavailable · setup required"}
        </span>
      </div>
      <div className="mobile-chat-tools">
        <button className="btn" onClick={() => setShowHistory(true)}>
          Conversations
        </button>
        <button className="btn" disabled={busy} onClick={() => setActive("")}>
          New chat
        </button>
      </div>
      <Modal
        open={showHistory}
        onClose={() => setShowHistory(false)}
        title="Saved conversations"
      >
        {list}
      </Modal>
      <div className="tutor-layout">
        <aside className="chat-history">
          <button
            className="btn primary"
            disabled={busy}
            onClick={() => setActive("")}
          >
            <Plus size={16} />
            New conversation
          </button>
          <div className="search-box">
            <Search size={16} />
            <input
              aria-label="Search conversations"
              placeholder="Search conversations"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="nav-caption">SAVED CONVERSATIONS</div>
          {list}
          <div className="history-foot">
            <ShieldCheck size={20} />
            <p>
              Answers you can check.
              <br />
              Sources you can open.
            </p>
          </div>
        </aside>
        <section className="chat-panel">
          <div className="chat-controls">
            <Pick
              label="Course"
              value={course}
              onChange={(v) => {
                setCourse(v);
                setActive("");
              }}
              options={courses}
            />
            <Pick
              label="Material"
              value={material}
              onChange={setMaterial}
              options={materials
                .filter(
                  (m) => m.course === course && m.status === "Ready to study",
                )
                .map((m) => ({ value: m.id, label: m.name }))}
            />
            <button
              className="btn ghost"
              aria-label="Delete conversation"
              disabled={busy || !active}
              onClick={remove}
            >
              <Trash2 size={17} />
            </button>
          </div>
          <div className="chat-messages">
            {!chat?.messages.length ? (
              <div className="tutor-welcome">
                <div className="tutor-emblem">
                  <Sparkles size={30} />
                </div>
                <h2>Let's make it make sense.</h2>
                <p>
                  Ask about your selected material. Relevant excerpts are sent
                  to the configured AI provider.
                </p>
                <div className="suggestions">
                  {[
                    "What is a primary key?",
                    "Explain normalization with an example.",
                    "What is the difference between schema and instance?",
                    "Explain quantum computing.",
                  ].map((p) => (
                    <button
                      key={p}
                      disabled={busy}
                      onClick={() => {
                        setInput(p);
                        ask(p);
                      }}
                    >
                      {p}
                      <MessageSquare size={14} />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              chat.messages.map((m) => (
                <div className={`message ${m.role}`} key={m.id}>
                  <span className="message-avatar">
                    {m.role === "tutor" ? <Sparkles size={18} /> : "S"}
                  </span>
                  <div className="message-body">
                    <b>{m.role === "tutor" ? "StudyMate" : "You"}</b>
                    {m.role === "tutor" && (
                      <span className="badge">
                        {m.evidence === "supported"
                          ? "Source quotes checked"
                          : "Not found in your material"}
                      </span>
                    )}
                    <div className="answer-text">{m.text}</div>
                    {m.sources?.map((r, i) => (
                      <div key={i}>
                        <Citation
                          page={r.page}
                          materialId={r.materialId}
                          title={r.title}
                          onOpen={source}
                        />
                        <blockquote>{r.text}</blockquote>
                      </div>
                    ))}
                    <button
                      className="text-button"
                      aria-label="Copy response"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(m.text);
                          toast.success("Copied");
                        } catch {
                          toast.error("Clipboard unavailable");
                        }
                      }}
                    >
                      <Copy size={15} />
                    </button>
                  </div>
                </div>
              ))
            )}
            {busy && (
              <p role="status" className="loading-answer">
                Retrieving sources and preparing an answer…
              </p>
            )}
            <div ref={end} />
          </div>
          <div className="composer-area">
            <Pick
              label="Explanation style"
              value={style}
              onChange={setStyle}
              options={[
                "Simple",
                "Step-by-step",
                "Exam-focused",
                "With examples",
              ]}
            />
            {!aiAvailable && <p className="notice" role="status">Your tutor is waiting for AI setup. You can still use prepared quizzes and revision cards.</p>}
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <form
              className="composer"
              onSubmit={(e) => {
                e.preventDefault();
                ask();
              }}
            >
              <textarea
                aria-label="Ask a question"
                disabled={busy || !aiAvailable || !material}
                maxLength={2000}
                placeholder="Ask a question about your notes…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <button
                className="send"
                disabled={busy || !input.trim() || !material || !aiAvailable}
                aria-label="Send question"
              >
                <Send size={19} />
              </button>
            </form>
            <small>
              Exact quotes are checked against your source. This does not
              guarantee that every AI claim is correct. Conversations are saved;
              each request uses your current question and material.
            </small>
          </div>
        </section>
        <aside className="context-panel">
          <span className="eyebrow">YOUR STUDY CONTEXT</span>
          <div className="course-icon">
            <BookOpen size={23} />
          </div>
          <h3>{course || "Choose a course"}</h3>
          <p>
            {materials.find((m) => m.id === material)?.name ||
              "Choose a ready material"}
          </p>
          <div className="notice vertical">
            <ShieldCheck size={22} />
            <b>Check the evidence</b>
            <p>
              Open citations to compare the answer with extracted source text.
              Unsupported questions receive a refusal.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
