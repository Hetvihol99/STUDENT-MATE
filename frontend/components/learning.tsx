"use client";
import { useState } from "react";
import {
  BookOpen,
  Search,
  RotateCcw,
  Check,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  FlaskConical,
  Play,
  Upload,
  Sparkles,
  GraduationCap,
  ShieldCheck,
  ClipboardCheck,
  ChartNoAxesCombined,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { Pick, Modal, Citation, Meter } from "@/components/study-ui";
import {
  initialTopics,
  Topic,
  answerQuestion,
  questionBank,
  grade,
} from "@/lib/demo";
export function Knowledge({ topics, source, practice, go, course }: any) {
  const [query, setQuery] = useState("");
  const [current, setCurrent] = useState("");
  const t = topics.find((t: Topic) => t.id === current) || topics[0];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">MATERIAL → UNDERSTANDING</div>
          <h1>Your knowledge, connected.</h1>
          <p>Saved source concepts for {course}.</p>
        </div>
        <button className="btn" onClick={() => go("library")}>
          Back to library
        </button>
      </div>
      {!t ? (
        <div className="empty card">Add a material to explore its content.</div>
      ) : (
        <div className="knowledge-layout">
          <aside className="card">
            <h3>{course}</h3>
            <div className="search-box spaced">
              <Search size={16} />
              <input
                placeholder="Find a topic…"
                aria-label="Find a topic"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="topic-tree">
              {topics
                .filter((t: Topic) =>
                  (t.name + " " + t.text)
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((x: Topic) => (
                  <button
                    key={x.id}
                    className={x.id === t.id ? "selected" : ""}
                    onClick={() => setCurrent(x.id)}
                  >
                    <BookOpen size={16} />
                    {x.name}
                  </button>
                ))}
            </div>
          </aside>
          <article className="card concept">
            <span className="badge">Source excerpt · page {t.page}</span>
            <h2>{t.name}</h2>
            <p style={{ whiteSpace: "pre-wrap" }}>{t.text}</p>
            <div className="example-box">
              <p>{t.example}</p>
            </div>
            <p>Prerequisites: {t.prereq}</p>
            <Citation
              page={t.page}
              materialId={t.materialId}
              title={t.sourceTitle}
              onOpen={source}
            />
            <div className="row spaced">
              <button className="btn primary" onClick={() => practice(t.id)}>
                Test my understanding
              </button>
              <button className="btn" onClick={() => go("tutor")}>
                Discuss with tutor
              </button>
            </div>
          </article>
        </div>
      )}
    </>
  );
}
export function Revision({
  topics,
  practice,
  source,
  reviewed,
  onReview,
}: any) {
  const [card, setCard] = useState(0);
  const [flip, setFlip] = useState(false);
  const [date, setDate] = useState("");
  const [minutes, setMinutes] = useState("30");
  const [plan, setPlan] = useState<string[]>([]);
  const t = topics[card % topics.length];
  if (!t)
    return (
      <div className="empty card">
        <h1>Build your recall collection</h1>
        <p>Add a material to create your first source-based flashcard.</p>
      </div>
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">COME BACK STRONGER</div>
          <h1>Your next step is right here.</h1>
          <p>
            Spend less time deciding what to study and more time understanding
            it.
          </p>
        </div>
        <span className="badge">
          <RotateCcw size={15} />
          {reviewed.length} topics reviewed
        </span>
      </div>
      <div className="two-col">
        <article className="card">
          <h2>Start where it matters</h2>
          {topics.map((t: Topic, i: number) => (
            <div className="revision-topic" key={t.id}>
              <span className="step-number">{i + 1}</span>
              <div>
                <h3>{t.name}</h3>
                <small>
                  {t.mastery}% estimated mastery ·{" "}
                  {reviewed.includes(t.id)
                    ? "Review saved"
                    : "10-minute focused session"}
                </small>
              </div>
              <button className="btn" onClick={() => practice(t.id)}>
                Practice
              </button>
            </div>
          ))}
        </article>
        <article className="card">
          <div className="section-title">
            <h2>A quick recall moment</h2>
            <span className="badge">
              {card + 1} / {topics.length}
            </span>
          </div>
          <button
            className={`flashcard ${flip ? "flipped" : ""}`}
            onClick={() => setFlip((f) => !f)}
            aria-label="Flip flashcard"
          >
            <small>{flip ? "THE IDEA" : "THINK FIRST"}</small>
            <h3>
              {flip ? t.text : `How would you explain ${t.name.toLowerCase()}?`}
            </h3>
            <span>
              {flip ? "Tap to see the question" : "Tap to reveal the answer"}
            </span>
          </button>
          <div className="row spread spaced">
            <button
              className="btn ghost"
              aria-label="Previous flashcard"
              onClick={() => {
                setCard((card + topics.length - 1) % topics.length);
                setFlip(false);
              }}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="text-button"
              onClick={() => {
                Promise.resolve(onReview(t.id)).then(
                  (ok) => ok && toast.success("Review saved"),
                );
              }}
            >
              <Check size={17} />
              Mark as reviewed
            </button>
            <button
              className="btn ghost"
              aria-label="Next flashcard"
              onClick={() => {
                setCard((card + 1) % topics.length);
                setFlip(false);
              }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <Citation
            page={t.page}
            materialId={t.materialId}
            title={t.sourceTitle}
            onOpen={source}
          />
        </article>
        <article className="card">
          <h2>A plan that fits your time</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const days = Math.ceil(
                (new Date(date + "T23:59:59").getTime() - Date.now()) /
                  86400000,
              );
              if (days <= 0) {
                toast.error("Choose a future exam date");
                return;
              }
              setPlan(
                topics.map(
                  (t: Topic, i: number) =>
                    `Session ${i + 1}: ${t.name} · ${Math.max(5, Math.floor(Number(minutes) / 2))} minutes of recall, then practice. ${Math.max(1, Math.ceil(days / 4))} day(s) between topic reviews.`,
                ),
              );
            }}
          >
            <div className="form-grid spaced">
              <label className="field">
                <span>Exam date</span>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <Pick
                label="Minutes per day"
                value={minutes}
                onChange={setMinutes}
                options={["15", "30", "45", "60"]}
              />
            </div>
            <button className="btn primary spaced">
              <CalendarDays size={16} />
              Make my study plan
            </button>
          </form>
          {plan.length > 0 && (
            <ol className="steps">
              {plan.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>
          )}
        </article>
        <article className="card">
          <h2>Revision history</h2>
          {reviewed.length ? (
            reviewed.map((id: string) => (
              <div className="activity-item" key={id}>
                <Check size={17} />
                <div>
                  <b>{topics.find((t: Topic) => t.id === id)?.name}</b>
                  <small>Review saved</small>
                </div>
              </div>
            ))
          ) : (
            <div className="empty">
              <RotateCcw size={27} />
              <p>
                Flip a flashcard and mark it reviewed. Your revision history
                will appear here.
              </p>
            </div>
          )}
        </article>
      </div>
    </>
  );
}
export function Evaluation() {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">VALIDATION & LIMITATIONS</div>
          <h1>Evidence over assumptions.</h1>
          <p>
            Functional checks and learning-quality evaluation answer different
            questions.
          </p>
        </div>
      </div>
      <div className="two-col">
        <article className="card">
          <h2>Included checks</h2>
          <p>
            The portable package includes automated checks for authentication,
            ownership, upload validation, grading, persistence and missing AI
            configuration. See docs/VALIDATION.md for the actual run results.
          </p>
        </article>
        <article className="card">
          <h2>Not yet measured</h2>
          <p>
            Retrieval recall, faithfulness, citation entailment, AI answer
            correctness and learning outcomes have no benchmark score. Quote
            checks verify literal source text, not the truth of every generated
            claim.
          </p>
        </article>
        <article className="card">
          <h2>Grading</h2>
          <p>
            MCQs use exact options. Short answers use normalized terms and
            accepted aliases; valid paraphrases can be marked incorrect.
            Numerical answers use the stored numeric key. Review generated
            answer keys before relying on them for assessment.
          </p>
        </article>
        <article className="card">
          <h2>Honest scope</h2>
          <p>
            PDF and text extraction are real. Video study text can use Gemini or your provided transcript. OCR, vector search,
            independent model verification and automated knowledge graphs are
            not included. Uploaded materials receive a document-level topic and
            excerpt recall card.
          </p>
        </article>
      </div>
    </>
  );
}
export function Landing({ go, setName, signin }: any) {
  const [student, setStudent] = useState("");
  return signin ? (
    <div className="signin card">
      <div className="tutor-emblem">
        <GraduationCap size={32} />
      </div>
      <h1>Make yourself at home.</h1>
      <p>Use platform authentication to open your private workspace.</p>
      <a
        className="btn primary spaced"
        href="/signin-with-chatgpt?return_to=%2F"
        target="_top"
      >
        Sign in with ChatGPT
      </a>
    </div>
  ) : (
    <div className="landing">
      <div className="eyebrow">
        YOUR SYLLABUS. YOUR AI TUTOR. YOUR WAY TO MASTER IT.
      </div>
      <h1>
        Stop Re-reading.
        <br />
        <span>Start Understanding.</span>
      </h1>
      <p>
        Turn your lectures, textbooks, and notes into a personal AI tutor that
        explains concepts, tests your knowledge, and helps you master what
        matters most.
      </p>
      <div className="row wrap">
        <button className="btn primary" onClick={() => go("signin")}>
          Start Learning
        </button>
        <a
          className="btn"
          href="#how-it-works"
          onClick={(e) => {
            e.preventDefault();
            document
              .getElementById("how-it-works")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          Explore How It Works
        </a>
      </div>
      <div className="product-preview">
        <div className="row spread">
          <b>StudyMate / Your study session</b>
          <span className="badge">Real interactive demo</span>
        </div>
        <div className="two-col spaced">
          <div>
            <span className="kicker">YOUR NEXT SMALL WIN</span>
            <h2>Make database keys click.</h2>
            <p>Keys & constraints</p>
            <Meter value={35} />
            <p>Illustrative preview · actual estimates start at zero</p>
            <button className="btn primary" onClick={() => go("dashboard")}>
              Explore dashboard
            </button>
          </div>
          <div className="preview-answer">
            <Sparkles size={20} />
            <h3>What is a primary key?</h3>
            <p>
              A primary key uniquely identifies each row. It must be unique and
              cannot contain NULL.
            </p>
            <span className="citation">
              <FileText size={15} />
              DBMS learning notes · p. 2
            </span>
          </div>
        </div>
      </div>
      <div id="how-it-works" className="three-col">
        {[
          ["01", "Upload", "Keep your notes together in a course."],
          ["02", "Learn", "Ask, explore, and open the supporting source."],
          ["03", "Improve", "Use your mistakes to guide the next practice."],
        ].map(([n, t, p]) => (
          <article className="card" key={n}>
            <span className="eyebrow">{n}</span>
            <h2>{t}</h2>
            <p>{p}</p>
          </article>
        ))}
      </div>
      <div className="two-col spaced">
        {[
          [
            Sparkles,
            "A tutor that meets you where you are",
            "Choose a simple explanation, a worked example, or exam essentials.",
          ],
          [
            ShieldCheck,
            "Trust you can check",
            "Open the exact source page and see what supports the explanation.",
          ],
          [
            ClipboardCheck,
            "Practice that closes the loop",
            "Answer questions, understand mistakes, then try targeted practice.",
          ],
          [
            ChartNoAxesCombined,
            "A clearer view of your progress",
            "See topic estimates and choose what to revise next.",
          ],
        ].map(([I, t, p]: any) => (
          <article className="card" key={t}>
            <I size={24} />
            <h3 className="spaced">{t}</h3>
            <p>{p}</p>
          </article>
        ))}
      </div>
      <section className="landing-end">
        <h2>A little understanding goes a long way.</h2>
        <p>
          Save your materials and practice results. Connect Gemini to enable
          source-backed tutoring and generated quizzes.
        </p>
        <button className="btn primary spaced" onClick={() => go("signin")}>
          Start Learning
        </button>
      </section>
    </div>
  );
}
