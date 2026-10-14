"use client";
import { useState, useEffect, useRef } from "react";
import {
  ClipboardCheck,
  Clock,
  Flag,
  Check,
  Target,
  RotateCcw,
  Trophy,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { Pick, Modal, Citation, Meter } from "@/components/study-ui";
import { initialTopics, Question, Attempt, Material, Topic } from "@/lib/demo";
import { selectPractice } from "@/lib/practice-selection";
import { api } from "@/lib/api-client";
export function Quiz({
  topics,
  target,
  courses,
  course,
  setCourse,
  materials,
  onComplete,
  source,
  practice,
  attempts,
  aiAvailable,
}: {
  topics: Topic[];
  target: string;
  courses: string[];
  course: string;
  setCourse: (s: string) => void;
  materials: Material[];
  onComplete: (a: Attempt) => void;
  source: (p: number) => void;
  practice: (t: string) => void;
  attempts: Attempt[];
  aiAvailable: boolean;
}) {
  const initial = selectPractice(topics, materials, course, target);
  const [error, setError] = useState("");
  const [quizId, setQuizId] = useState("");
  const [busy, setBusy] = useState(false);
  const [generation, setGeneration] = useState(initial.source);
  const [verification, setVerification] = useState("");
  const [topic, setTopic] = useState(initial.topic);
  const [type, setType] = useState("Mixed");
  const [difficulty, setDifficulty] = useState("Adaptive");
  const [count, setCount] = useState("5");
  const [mode, setMode] = useState("Practice quiz");
  const [material, setMaterial] = useState(initial.materialId);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [flags, setFlags] = useState<string[]>([]);
  const [result, setResult] = useState<Attempt | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [seconds, setSeconds] = useState(600);
  const submitted = useRef(false);
  useEffect(() => {
    const selected = selectPractice(topics, materials, course, target);
    setTopic(selected.topic); setMaterial(selected.materialId); setGeneration(selected.source);
    setError("");
    setQuestions([]);
    setResult(null);
    setAnswers({});
    setIndex(0);
    submitted.current = false;
  }, [target]);
  useEffect(() => {
    if (!questions.length || result || mode !== "Mock exam") return;
    const id = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [questions.length, result, mode]);
  useEffect(() => {
    if (seconds === 0 && questions.length && !result) submit();
  }, [seconds]);
  useEffect(() => {
    if (!materials.some(m => m.id === material && m.course === course && m.status === "Ready to study")) {
      const selected = selectPractice(topics, materials, course, target);
      setMaterial(selected.materialId); setTopic(selected.topic); setGeneration(selected.source);
    }
  }, [materials, course, material, target, topics]);
  useEffect(() => {
    const selected = materials.find(m => m.id === material);
    if (selected) setGeneration(selected.seeded ? "prepared" : "ai");
    if (topic !== "all" && !topics.some(t => t.id === topic && t.materialId === material)) setTopic("all");
  }, [material]);
  async function start() {
    if (busy || !material || (generation === "ai" && !aiAvailable)) return;
    setBusy(true); setError("");
    try {
      const data = await api("quizzes", "POST", {
        course,
        materialId: material,
        topic,
        type,
        difficulty,
        count: Number(count),
        mode,
        source: generation,
      });
      if (!Array.isArray(data.questions) || !data.questions.length) throw new Error("No questions were returned. Try another topic or material.");
      setQuizId(data.id);
      setVerification(data.verification);
      if (data.repeated)
        toast.info(
          "Some prepared questions repeat because this small bank is exhausted.",
        );
      if (data.questions.length < Number(count))
        toast.info("Using all matching prepared questions.");
      setQuestions(data.questions);
      setAnswers({});
      setResult(null);
      setIndex(0);
      setFlags([]);
      setSeconds(
        data.expiresAt
          ? Math.max(
              0,
              Math.floor((Date.parse(data.expiresAt) - Date.now()) / 1000),
            )
          : 600,
      );
      submitted.current = false;
    } catch (e: any) {
      setError(e.message);
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (submitted.current || busy) return;
    submitted.current = true;
    setBusy(true);
    try {
      const a = await api("quizzes/" + quizId + "/submit", "POST", { answers });
      setQuestions(a.questions);
      setResult(a);
      setConfirm(false);
      onComplete(a);
    } catch (e: any) {
      submitted.current = false;
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (result) {
    const weak = [
      ...new Set(
        result.questions
          .filter((q, i) => !result.results[i])
          .map((q) => q.topic),
      ),
    ];
    return (
      <>
        <div className="page-heading">
          <div>
            <div className="eyebrow">EVERY ATTEMPT TEACHES YOU SOMETHING</div>
            <h1>Your learning, a little clearer.</h1>
            <p>Review your answers, then take the next small step.</p>
          </div>
          <button
            className="btn"
            onClick={() => {
              setQuestions([]);
              setResult(null);
            }}
          >
            <RotateCcw size={16} />
            New quiz
          </button>
        </div>
        <section className="result-hero">
          <div
            className="score-circle"
            style={{
              background: `conic-gradient(#6e6e6e ${result.score}%,#e0e0e0 0)`,
            }}
          >
            <div>
              <strong>{result.score}%</strong>
              <span>Your score</span>
            </div>
          </div>
          <div>
            <span className="badge">{mode} complete</span>
            <h2>
              {result.score >= 75
                ? "That practice is paying off."
                : "You’ve found your next focus."}
            </h2>
            <p>
              {result.results.filter(Boolean).length} correct ·{" "}
              {result.results.filter((x) => !x).length} incorrect ·{" "}
              {questions.length} questions
            </p>
            <small>
              Mastery updated using 70% previous estimate + 30% topic quiz
              score.
            </small>
          </div>
        </section>
        <div className="two-col">
          <article className="card">
            <h2>Topic-wise performance</h2>
            {[...new Set(questions.map((q) => q.topic))].map((t) => {
              const idx = questions
                .map((q, i) => (q.topic === t ? i : -1))
                .filter((i) => i >= 0);
              const score = Math.round(
                (idx.filter((i) => result.results[i]).length / idx.length) *
                  100,
              );
              return (
                <div className="topic-score" key={t}>
                  <div className="row spread">
                    <b>
                      {topics.find((x) => x.id === t)?.name || "Material topic"}
                    </b>
                    <span>{score}%</span>
                  </div>
                  <Meter value={score} label={`${score}% correct for this topic`} />
                </div>
              );
            })}
          </article>
          <article className="card">
            <h2>Your next practice</h2>
            {weak.length ? (
              weak.map((t) => (
                <div className="recommendation" key={t}>
                  <div>
                    <b>
                      {topics.find((x) => x.id === t)?.name || "Material topic"}
                    </b>
                    <p>Review the explanation, then try another question.</p>
                  </div>
                  <button
                    className="btn primary"
                    onClick={() => {
                      setQuestions([]);
                      setResult(null);
                      setTopic(t);
                      practice(t);
                    }}
                  >
                    Practice this topic
                  </button>
                </div>
              ))
            ) : (
              <>
                <p>
                  All answers correct. Revisit a new question to strengthen
                  recall.
                </p>
                <button
                  className="btn primary"
                  onClick={() => {
                    setQuestions([]);
                    setResult(null);
                    setTopic("all");
                  }}
                >
                  Keep practicing
                </button>
              </>
            )}
            <div className="difficulty-summary">
              {["Easy", "Medium"].map((d) => {
                const idx = questions
                  .map((q, i) => (q.difficulty === d ? i : -1))
                  .filter((i) => i >= 0);
                return (
                  <span key={d}>
                    {d}: {idx.filter((i) => result.results[i]).length}/
                    {idx.length}
                  </span>
                );
              })}
            </div>
          </article>
        </div>
        <div className="section-title spaced">
          <h2>Question review</h2>
          <span className="badge">{verification}</span>
        </div>
        {questions.map((q, i) => (
          <article className="card review-card" key={q.id}>
            <div className="row spread">
              <span className={`badge ${result.results[i] ? "green" : "red"}`}>
                {result.results[i] ? "Correct" : "Needs another look"}
              </span>
              <small>
                {q.difficulty} · {q.type}
              </small>
            </div>
            <h3>
              {i + 1}. {q.prompt}
            </h3>
            <p>
              Your answer: <strong>{answers[q.id] || "Not answered"}</strong>
            </p>
            <div className="answer-explanation">
              <b>Correct answer: {q.answer}</b>
              <p>{q.explanation}</p>
              {!result.results[i] && (
                <p>
                  Revision cue: distinguish this definition from the alternative
                  you selected. This is a review suggestion, not a diagnosed
                  misconception.
                </p>
              )}
            </div>
            <Citation
              page={q.page}
              materialId={q.materialId}
              title={q.sourceTitle}
              onOpen={source}
            />
          </article>
        ))}
      </>
    );
  }
  if (questions.length) {
    const q = questions[index];
    return (
      <>
        <div className="page-heading">
          <div>
            <span className="eyebrow">
              {mode.toUpperCase()} / {course.toUpperCase()}
            </span>
            <h1>A little challenge. A stronger you.</h1>
          </div>
          <span className="badge">
            <Clock size={15} />
            {mode === "Mock exam"
              ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} remaining`
              : "Take your time"}
          </span>
        </div>
        <div className="quiz-layout">
          <article className="card question-card">
            <div className="row spread">
              <span>
                Question {index + 1} of {questions.length}
              </span>
              <span className="badge">
                {q.difficulty} · {q.type}
              </span>
            </div>
            <Meter value={((index + 1) / questions.length) * 100} label={`Question ${index + 1} of ${questions.length}`} />
            <div className="eyebrow spaced">
              {topics.find((t) => t.id === q.topic)?.name || "Material topic"}
            </div>
            <h2>{q.prompt}</h2>
            {q.options ? (
              <div
                className="answer-options"
                role="radiogroup"
                aria-label="Answer options"
              >
                {q.options.map((o, i) => (
                  <label
                    key={o}
                    className={answers[q.id] === o ? "selected" : ""}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      value={o}
                      checked={answers[q.id] === o}
                      onChange={() => setAnswers((a) => ({ ...a, [q.id]: o }))}
                    />
                    <span className="option-letter">
                      {String.fromCharCode(65 + i)}
                    </span>
                    {o}
                  </label>
                ))}
              </div>
            ) : (
              <label className="field spaced">
                <span>
                  {q.type === "Numerical"
                    ? "Enter a number"
                    : "Enter a short term or phrase"}
                </span>
                <input
                  type={q.type === "Numerical" ? "number" : "text"}
                  value={answers[q.id] || ""}
                  onChange={(e) =>
                    setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                  }
                />
                {q.type === "Short answer" && (
                  <small>
                    Short-answer grading matches the expected term and a small
                    set of accepted variants.
                  </small>
                )}
              </label>
            )}
            <button
              className="text-button spaced"
              onClick={() =>
                setFlags((f) =>
                  f.includes(q.id)
                    ? f.filter((id) => id !== q.id)
                    : [...f, q.id],
                )
              }
            >
              <Flag size={16} />
              {flags.includes(q.id) ? "Marked for review" : "Mark for review"}
            </button>
            <div className="question-footer">
              <button
                className="btn"
                disabled={!index}
                onClick={() => setIndex((i) => i - 1)}
              >
                Previous
              </button>
              {index < questions.length - 1 ? (
                <button
                  className="btn primary"
                  onClick={() => setIndex((i) => i + 1)}
                >
                  Next question
                </button>
              ) : (
                <button
                  className="btn primary"
                  onClick={() => setConfirm(true)}
                >
                  Submit quiz
                </button>
              )}
            </div>
          </article>
          <aside className="card question-map">
            <h3>Your questions</h3>
            <div className="question-numbers">
              {questions.map((q, i) => (
                <button
                  key={q.id}
                  aria-label={`Go to question ${i + 1}${flags.includes(q.id) ? ", marked for review" : ""}`}
                  className={`${index === i ? "current" : ""} ${answers[q.id] ? "answered" : ""} ${flags.includes(q.id) ? "flagged" : ""}`}
                  onClick={() => setIndex(i)}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <p>
              {Object.keys(answers).filter((k) => answers[k]).length} of{" "}
              {questions.length} answered
            </p>
            <small>
              Black: current · Green: answered
              <br />
              Amber border: marked for review
            </small>
            <button
              className="btn primary spaced"
              onClick={() => setConfirm(true)}
            >
              Finish assessment
            </button>
          </aside>
        </div>
        <Modal
          open={confirm}
          onClose={() => setConfirm(false)}
          title="Ready to see your results?"
          description={`${questions.filter((q) => !answers[q.id]?.trim()).length} unanswered questions will be scored as incorrect.`}
        >
          <div className="row">
            <button className="btn" onClick={() => setConfirm(false)}>
              Keep reviewing
            </button>
            <button className="btn primary" disabled={busy} onClick={submit}>
              {busy ? "Saving…" : "Confirm submission"}
            </button>
          </div>
        </Modal>
      </>
    );
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">TURN UNDERSTANDING INTO CONFIDENCE</div>
          <h1>Practice with purpose.</h1>
          <p>A quick check today makes tomorrow's revision easier.</p>
        </div>
        <span className="badge">
          <ClipboardCheck size={15} />
          Saved, source-linked assessments
        </span>
      </div>
      <div className="quiz-config-layout">
        <article className="card">
          <div className="section-title">
            <h2>Build your practice session</h2>
            <span className="badge">
              {target ? "Targeted practice" : "Your pace, your scope"}
            </span>
          </div>
          <div className="form-grid">
            <Pick
              label="Course"
              value={course}
              onChange={setCourse}
              options={courses}
            />
            <Pick
              label="Material"
              value={material}
              onChange={setMaterial}
              options={materials
                .filter((m) => m.course === course && m.status === "Ready to study")
                .map((m) => ({ value: m.id, label: m.name }))}
            />
            <Pick
              label="Topic"
              value={topic}
              onChange={setTopic}
              options={[
                { value: "all", label: "All material topics" },
                ...topics
                  .filter((t) => t.materialId === material)
                  .map((t) => ({ value: t.id, label: t.name })),
              ]}
            />
            <Pick
              label="Number of questions"
              value={count}
              onChange={setCount}
              options={["3", "5", "10"]}
            />
            <Pick
              label="Difficulty"
              value={difficulty}
              onChange={setDifficulty}
              options={["Adaptive", "Easy", "Medium"]}
            />
            <Pick
              label="Question type"
              value={type}
              onChange={setType}
              options={["Mixed", "MCQ", "Short answer", "Numerical"]}
            />
            <Pick
              label="Question source"
              value={generation}
              onChange={setGeneration}
              options={[
                ...(materials.find(m => m.id === material)?.seeded ? [{ value: "prepared", label: "Prepared DBMS bank" }] : []),
                { value: "ai", label: aiAvailable ? "AI generation" : "AI generation · unavailable" },
              ]}
            />
            <Pick
              label="Session type"
              value={mode}
              onChange={setMode}
              options={["Practice quiz", "Mock exam"]}
            />
          </div>
          <div className="notice spaced">
            <BookOpen size={20} />
            <span>
              Prepared questions use reviewed sample keys. AI questions use your
              extracted material and require Gemini. Source quotes and format
              are checked; AI answer correctness is not independently verified.
              Adaptive requests a mix of difficulty levels.
            </span>
          </div>
          {error && <p className="error spaced" role="alert">{error}</p>}
          {!material && <p className="notice spaced">Add a ready material to this course to start a quiz.</p>}
          {generation === "ai" && !aiAvailable && <p className="notice spaced">AI quizzes need AI setup. Use the sample notes for prepared practice.</p>}
          <button
            className="btn primary spaced"
            disabled={busy || !material || (generation === "ai" && !aiAvailable)}
            onClick={start}
          >
            <SparklesIcon />
            {busy ? "Preparing…" : "Start practice"}
          </button>
        </article>
        <aside>
          <article className="card accent-card">
            <Target size={27} />
            <h2>New here? Find your starting point.</h2>
            <p>
              A short diagnostic across this material’s topics will show where to begin.
            </p>
            <button
              className="btn"
              onClick={() => {
                setTopic("all");
                setType("Mixed");
                setDifficulty("Adaptive");
                setCount("5");
                setMode("Practice quiz");
                toast.info("Diagnostic configured. Select Start practice.");
              }}
            >
              Set up diagnostic quiz
            </button>
          </article>
          <article className="card spaced">
            <h3>What happens next?</h3>
            <ol className="steps">
              <li>Check your understanding.</li>
              <li>See why each answer works.</li>
              <li>Practice the topics that need you.</li>
            </ol>
          </article>
        </aside>
      </div>
    </>
  );
}
function SparklesIcon() {
  return <Target size={17} />;
}
