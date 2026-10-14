"use client";
import { useState, useEffect, useRef, lazy, Suspense, ReactNode } from "react";
import {
  BookOpen,
  LayoutDashboard,
  Library,
  Sparkles,
  ClipboardCheck,
  ChartNoAxesCombined,
  RotateCcw,
  Settings,
  Upload,
  GraduationCap,
  Clock,
  Target,
  Flame,
  FlaskConical,
  Plus,
  FileText,
  ChevronRight,
  Download,
} from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarInset,
  useSidebar,
} from "@/components/ui/sidebar";
import { Toaster, toast } from "sonner";
import { Modal, Source, Meter } from "@/components/study-ui";
import { Tutor } from "@/components/tutor";
import { Quiz } from "@/components/quiz";
import { LibraryView, UploadModal } from "@/components/materials";
import {
  Knowledge,
  Revision,
  Evaluation,
  Landing,
} from "@/components/learning";
import {
  initialTopics,
  initialMaterials,
  Topic,
  Material,
  Attempt,
  updateMastery,
} from "@/lib/demo";
import { AuthScreen, PasswordSettings } from "@/components/auth";
import { api } from "@/lib/api-client";
import { useStudyTools } from "@/hooks/use-study-tools";
const MasteryChart = lazy(() => import("@/components/progress-charts").then(module => ({default: module.MasteryChart})));
const PerformanceChart = lazy(() => import("@/components/progress-charts").then(module => ({default: module.PerformanceChart})));
const navigation = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["courses", "My Courses", BookOpen],
  ["library", "My Library", Library],
  ["tutor", "AI Tutor", Sparkles],
  ["practice", "Practice & Quizzes", ClipboardCheck],
  ["progress", "My Progress", ChartNoAxesCombined],
  ["revision", "Revision Center", RotateCcw],
] as const;
const pages = [
  ...navigation.map((x) => x[0]),
  "knowledge",
  "settings",
  "evaluation",
  "welcome",
  "signin",
];
export default function Home() {
  return (
    <SidebarProvider>
      <StudyApp />
      <Toaster position="bottom-right" richColors />
    </SidebarProvider>
  );
}
function StudyApp() {
  const [page, setPage] = useState("dashboard");
  const [courses, setCourses] = useState<string[]>([]);
  const [course, setCourse] = useState("");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [activity, setActivity] = useState<string[]>([]);
  const [source, setSource] = useState<any>(null);
  const [upload, setUpload] = useState(false);
  const [create, setCreate] = useState(false);
  const [courseName, setCourseName] = useState("");
  const [target, setTarget] = useState("");
  const [practiceKey, setPracticeKey] = useState(0);
  const [name, setName] = useState("Student");
  const [sessions, setSessions] = useState(0);
  const [studied, setStudied] = useState<string[]>([]);
  const [reviewed, setReviewed] = useState<string[]>([]);
  const { setOpenMobile } = useSidebar();
  const [authProvider, setAuthProvider] = useState<"password" | "chatgpt">("chatgpt");
  const [libraryCourse, setLibraryCourse] = useState("All courses");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("loading");
  const [failure, setFailure] = useState("");
  const [videoAvailable, setVideoAvailable] = useState(false);
  const [limits, setLimits] = useState({uploadMb: 5, videoMb: 50, videoMinutes: 60});
  const [aiAvailable, setAiAvailable] = useState(false);
  const sessionEpoch = useRef(0);
  const [revision, setRevision] = useState(0);
  function apply(d: any) {
    setCourses(d.courses);
    setCourse((c) => (d.courses.includes(c) ? c : d.courses[0] || ""));
    setMaterials(d.materials);
    setTopics(d.topics);
    setAttempts(d.attempts);
    setSessions(d.attempts.length);
    setActivity(d.activity);
    setReviewed(d.reviewed);
    setName(d.user.name);
    setAiAvailable(d.aiAvailable);
    setVideoAvailable(Boolean(d.videoAvailable));
    if (d.limits) setLimits(d.limits);
    setStatus("ready");
    setRevision((v) => v + 1);
  }
  async function refresh() {
    const epoch = sessionEpoch.current;
    try {
      const data = await api("state");
      if (epoch === sessionEpoch.current) apply(data);
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  async function bootstrap() {
    const epoch = sessionEpoch.current;
    setStatus("loading");
    try {
      const data = await api("bootstrap", "POST", {});
      if (epoch === sessionEpoch.current) apply(data);
    } catch (e: any) {
      setFailure(e.message);
      setStatus(e.status === 401 ? "signin" : "error");
    }
  }
  async function save(path: string, method: string, body?: unknown) {
    if (saving) return false;
    setSaving(true);
    try {
      await api(path, method, body);
      await refresh();
      return true;
    } catch (e: any) {
      toast.error(e.message);
      return false;
    } finally { setSaving(false); }
  }
  useEffect(() => {
    api("auth/config").then(config => setAuthProvider(config.provider)).catch(() => {}).finally(bootstrap);
    const expired = () => {
      sessionEpoch.current++;
      setOpenMobile(false); window.scrollTo({top: 0});
      setSessions(0); setStudied([]); setSaving(false);
      setCourses([]); setMaterials([]); setTopics([]); setAttempts([]); setActivity([]); setReviewed([]);
      setSource(null); setUpload(false); setCreate(false); setName("Student"); setAiAvailable(false);
      setCourse(""); setLibraryCourse("All courses"); setStatus("signin");
    };
    window.addEventListener("studymate:session-expired", expired);
    return () => window.removeEventListener("studymate:session-expired", expired);
  }, []);
  useEffect(() => {
    const sync = () => {
      const p = location.hash.slice(1).split("?")[0];
      setPage(pages.includes(p as any) ? p : "dashboard");
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  function go(p: string) {
    location.hash = p;
    setPage(p);
    setOpenMobile(false);
    window.scrollTo({ top: 0 });
  }
  function practice(t = "") {
    setTarget(t);
    setPracticeKey((k) => k + 1);
    const found = topics.find((x) => x.id === t);
    const m = materials.find((m) => m.id === found?.materialId);
    if (m) setCourse(m.course);
    go("practice");
  }
  function log(s: string) {
    setActivity((a) => [s, ...a].slice(0, 20));
  }
  function complete(a: Attempt) {
    refresh();
    toast.success("Results and topic estimates saved.");
  }
  useStudyTools(topics, practice);
  const weak = [...topics].sort((a, b) => a.mastery - b.mastery);
  const next = weak[0];
  const courseTopics = topics.filter(t => materials.some(m => m.id === t.materialId && m.course === course));
  const courseNext = [...courseTopics].sort((a,b) => a.mastery - b.mastery)[0];
  const avg = attempts.length
    ? Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length)
    : null;
  const heading = (title: string, sub: string, action?: ReactNode) => (
    <div className="page-heading">
      <div>
        <div className="eyebrow">YOUR PERSONAL LEARNING WORKSPACE</div>
        <h1>{title}</h1>
        <p>{sub}</p>
      </div>
      {action}
    </div>
  );
  if (status === "signin") return <AuthScreen provider={authProvider} onSuccess={async () => {go("dashboard"); await bootstrap();}}/>;
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <Sidebar className="study-sidebar" collapsible="icon">
        <SidebarHeader>
          <button
            className="brand"
            onClick={() => go("dashboard")}
            aria-label="StudyMate dashboard"
          >
            <span className="brand-icon">
              <GraduationCap />
            </span>
            <span className="brand-name">StudyMate</span>
            <span className="ai">AI</span>
          </button>
        </SidebarHeader>
        <SidebarContent>
          <div className="nav-caption">YOUR WORKSPACE</div>
          <SidebarMenu>
            {navigation.map(([id, label, Icon]) => (
              <SidebarMenuItem key={id}>
                <SidebarMenuButton
                  tooltip={label}
                  isActive={page === id}
                  onClick={() => go(id)}
                >
                  <Icon />
                  <span>{label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
          <button
            className="btn primary upload-nav"
            onClick={() => setUpload(true)}
          >
            <Upload size={17} />
            <span>Upload Material</span>
          </button>
        </SidebarContent>
        <SidebarFooter>
          <div className="demo-note">
            <FlaskConical size={18} />
            <div>
              <b>A safe space to explore</b>
              <small>Saved to your private workspace</small>
            </div>
          </div>
          <SidebarMenuButton
            isActive={page === "evaluation"}
            onClick={() => go("evaluation")}
            tooltip="Evaluation"
          >
            <FlaskConical />
            <span>Evaluation lab</span>
          </SidebarMenuButton>
          <SidebarMenuButton
            isActive={page === "settings"}
            onClick={() => go("settings")}
            tooltip="Settings"
          >
            <Settings />
            <span>Settings</span>
          </SidebarMenuButton>
          <button className="profile" onClick={() => go("settings")}>
            <span className="avatar">{name[0] || "S"}</span>
            <div>
              <b>{name}</b>
              <small>Personal study workspace</small>
            </div>
          </button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="topbar">
          <div className="row">
            <SidebarTrigger />
            <span>
              Workspace <span className="muted">/</span>{" "}
              {navigation.find((n) => n[0] === page)?.[1] ||
                (
                  {
                    knowledge: "Knowledge base",
                    evaluation: "Evaluation lab",
                    settings: "Settings",
                    welcome: "Welcome",
                    signin: "Sign in",
                  } as any
                )[page]}
            </span>
          </div>
          <div className="row">
            <button className="top-help" onClick={() => go("welcome")}>
              About StudyMate
            </button>
            <span className="badge">
              {aiAvailable ? "AI ready" : "Prepared practice available"}
            </span>
            <span className="avatar small">{name[0]}</span>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className={`main ${page === "tutor" ? "tutor-main" : ""}`}>
          {status !== "ready" ? (
            <div className="empty card">
              <GraduationCap size={40} />
              <h1>
                {status === "loading"
                  ? "Opening your workspace…"
                  : status === "signin"
                    ? "Your learning, saved privately."
                    : "Workspace unavailable"}
              </h1>
              <p>
                {status === "loading"
                  ? "Checking your account and saved data."
                  : failure}
              </p>
              {status === "error" && <button className="btn" onClick={bootstrap}>Retry</button>}

            </div>
          ) : (
            <>
              {!materials.length && (
                <div className="notice spaced">
                  <span>
                    Start with your own notes or the public sample DBMS dataset.
                    Your progress starts at zero.
                  </span>
                  <button
                    className="btn primary"
                    onClick={() => setUpload(true)}
                  >
                    Add learning material
                  </button>
                </div>
              )}
              {page === "dashboard" && (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">
                        A LITTLE PROGRESS, EVERY DAY
                      </div>
                      <h1>
                        Let’s make it count, {name} <span className="sun">☀</span>
                      </h1>
                      <p>Let's make progress on what matters today.</p>
                    </div>
                    <span className="streak">
                      <Flame size={17} />
                      {sessions
                        ? `${sessions} study sessions completed`
                        : "Your learning starts here"}
                    </span>
                  </div>
                  <section className="focus-banner">
                    <div>
                      <span className="kicker">
                        <Sparkles size={16} />
                        YOUR NEXT SMALL WIN
                      </span>
                      <h2>
                        {next?.id === "keys"
                          ? "Make database keys click."
                          : "Keep your understanding growing."}
                      </h2>
                      <p>
                        A focused session on{" "}
                        {next?.name.toLowerCase() || "your material"} will
                        help you build a stronger understanding.
                      </p>
                      <button
                        className="btn white"
                        onClick={() => practice(next?.id)}
                      >
                        Start a 10-minute practice
                      </button>
                    </div>
                    <div className="focus-orbit">
                      <div className="ring">
                        <span>
                          10<small>MINUTES</small>
                        </span>
                      </div>
                      <span className="orbit-label">
                        <Target size={15} />
                        One topic. More confidence.
                      </span>
                    </div>
                  </section>
                  <div className="stats">
                    {[
                      [
                        Library,
                        "Learning materials",
                        String(materials.length),
                        "Stored in your workspace",
                      ],
                      [
                        Clock,
                        "Study sessions",
                        String(sessions),
                        "Saved quiz attempts",
                      ],
                      [
                        ClipboardCheck,
                        "Average quiz score",
                        avg === null ? "—" : `${avg}%`,
                        avg === null
                          ? "Take your first quiz"
                          : "From your completed attempts",
                      ],
                      [
                        Target,
                        "Topics mastered",
                        `${topics.filter((t) => t.mastery >= 75).length} / ${topics.length}`,
                        "Estimated · 75%+ threshold",
                      ],
                    ].map(([Icon, title, value, note]: any) => (
                      <article className="stat" key={title}>
                        <div className="row spread">
                          <span>{title}</span>
                          <Icon size={18} />
                        </div>
                        <strong>{value}</strong>
                        <small>{note}</small>
                      </article>
                    ))}
                  </div>
                  <div className="dashboard-grid">
                    <article className="card">
                      <div className="section-title">
                        <h2>Continue learning</h2>
                        <button
                          className="text-button"
                          onClick={() => go("courses")}
                        >
                          All courses
                        </button>
                      </div>
                      <div className="course-main">
                        <div className="course-icon">
                          <BookOpen size={25} />
                        </div>
                        <div>
                          <small>YOUR COURSE</small>
                          <h3>{course || "Your first course"}</h3>
                          <p>
                            {studied.length
                              ? "Last explored: " +
                                topics.find(
                                  (t) => t.id === studied[studied.length - 1],
                                )?.name
                              : courseTopics.length + " saved topics"}
                          </p>
                        </div>
                      </div>
                      <div className="row spread">
                        <span>Average topic estimate</span>
                        <b>
                          {Math.round(
                            courseTopics.reduce((s, t) => s + t.mastery, 0) /
                              (courseTopics.length || 1),
                          )}
                          %
                        </b>
                      </div>
                      <Meter
                        value={
                          courseTopics.reduce((s, t) => s + t.mastery, 0) /
                          (courseTopics.length || 1)
                        }
                      />
                      <div className="row spread spaced">
                        <span className="muted">
                          Up next: {courseNext?.name || "add your first material"}
                        </span>
                        <button
                          className="btn primary"
                          onClick={() => {
                            go("knowledge");
                          }}
                        >
                          Continue learning
                        </button>
                      </div>
                    </article>
                    <article className="card">
                      <div className="section-title">
                        <h2>Focus on these topics</h2>
                        <span className="badge amber">Needs practice</span>
                      </div>
                      {weak.slice(0, 2).map((t) => (
                        <div className="focus-topic" key={t.id}>
                          <div className="row spread">
                            <h3>{t.name}</h3>
                            <span className="amber-text">{t.mastery}%</span>
                          </div>
                          <Meter value={t.mastery} />
                          <div className="row spread">
                            <small>
                              {t.attempts
                                ? "Updated from your quiz"
                                : "Not practiced yet"}
                            </small>
                            <button
                              className="text-button"
                              onClick={() => practice(t.id)}
                            >
                              Practice now
                            </button>
                          </div>
                        </div>
                      ))}
                    </article>
                    <article className="card">
                      <div className="section-title">
                        <h2>Your learning progress</h2>
                        <button
                          className="text-button"
                          onClick={() => go("progress")}
                        >
                          View progress
                        </button>
                      </div>
                      <div className="chart">
                        <Suspense fallback={<div className="chart-loading" role="status">Loading progress chart…</div>}><MasteryChart topics={topics}/></Suspense>
                      </div>
                      <small>
                        Estimates begin at zero and update from saved quiz
                        attempts.
                      </small>
                    </article>
                    <article className="card">
                      <div className="section-title">
                        <h2>Recent activity</h2>
                        <Clock size={17} className="muted" />
                      </div>
                      <div className="activity-list">
                        {activity.slice(0, 4).map((a, i) => (
                          <div className="activity-item" key={i}>
                            <span className="activity-icon">
                              {i % 2 ? (
                                <ClipboardCheck size={16} />
                              ) : (
                                <FileText size={16} />
                              )}
                            </span>
                            <div>
                              <b>{a}</b>
                              <small>Saved activity</small>
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>
                  </div>
                  <div className="quick-actions">
                    {[
                      [Upload, "Upload notes", () => setUpload(true)],
                      [Sparkles, "Ask AI Tutor", () => go("tutor")],
                      [ClipboardCheck, "Create a quiz", () => practice()],
                      [RotateCcw, "Review weak topics", () => go("revision")],
                    ].map(([Icon, text, fn]: any) => (
                      <button key={text} onClick={fn}>
                        <Icon size={19} />
                        {text}
                        <ChevronRight size={15} />
                      </button>
                    ))}
                  </div>
                </>
              )}
              {page === "courses" && (
                <>
                  {heading(
                    "A place for every subject.",
                    "Keep your learning materials together, one course at a time.",
                    <button
                      className="btn primary"
                      onClick={() => setCreate(true)}
                    >
                      <Plus size={17} />
                      Create course
                    </button>,
                  )}
                  <div className="course-grid">
                    {courses.map((c, i) => (
                      <article className="card course-card" key={c}>
                        <div className={`course-icon tone-${i % 3}`}>
                          <BookOpen size={25} />
                        </div>
                        <span className="badge">
                          {c === course ? "Selected course" : "Course"}
                        </span>
                        <h2>{c}</h2>
                        <p>
                          {materials.filter((m) => m.course === c).length}{" "}
                          materials ·{" "}
                          {
                            topics.filter((t) =>
                              materials.some(
                                (m) => m.id === t.materialId && m.course === c,
                              ),
                            ).length
                          }{" "}
                          topics
                        </p>
                        {i === 0 ? (
                          <Meter
                            value={
                              topics.reduce((s, t) => s + t.mastery, 0) /
                              (topics.length || 1)
                            }
                          />
                        ) : (
                          <div className="empty-line" />
                        )}
                        <div className="row spaced">
                          <button
                            className="btn primary"
                            onClick={() => {
                              setCourse(c);
                              go("library");
                            }}
                          >
                            Open course
                          </button>
                          <button
                            className="btn"
                            onClick={() => {
                              setCourse(c);
                              setUpload(true);
                            }}
                            aria-label={`Upload to ${c}`}
                          >
                            <Upload size={17} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              )}
              {page === "library" && (
                <>
                  {heading(
                    "Your material. All together.",
                    "Find a source, explore a concept, or add something new.",
                    <button
                      className="btn primary"
                      onClick={() => setUpload(true)}
                    >
                      <Upload size={17} />
                      Upload material
                    </button>,
                  )}
                  <LibraryView
                    materials={materials}
                    refresh={refresh}
                    courses={courses}
                    course={libraryCourse}
                    setCourse={setLibraryCourse}
                    source={setSource}
                    upload={() => setUpload(true)}
                    go={go}
                  />
                </>
              )}
              {page === "knowledge" && (
                <Knowledge
                  topics={topics.filter((t) =>
                    materials.some(
                      (m) => m.id === t.materialId && m.course === course,
                    ),
                  )}
                  source={setSource}
                  practice={practice}
                  go={go}
                  course={course}
                />
              )}
              <div hidden={page !== "tutor"}>
                {
                  <Tutor
                    courses={courses}
                    course={course}
                    setCourse={setCourse}
                    materials={materials}
                    source={setSource}
                    aiAvailable={aiAvailable}
                    revision={revision}
                  />
                }
              </div>
              <div hidden={page !== "practice"}>
                <Quiz
                  topics={topics}
                  key={practiceKey}
                  target={target}
                  courses={courses}
                  course={course}
                  setCourse={setCourse}
                  materials={materials}
                  onComplete={complete}
                  source={setSource}
                  practice={practice}
                  attempts={attempts}
                aiAvailable={aiAvailable}
                  />
              </div>
              {page === "progress" && (
                <>
                  {heading(
                    "See how far you’re coming.",
                    "Understand your strengths and decide what deserves your attention next.",
                    <button className="btn primary" onClick={() => practice()}>
                      Take a diagnostic
                    </button>,
                  )}
                  <div className="notice">
                    <Target size={20} />
                    <span>
                      These are explainable study estimates, not validated
                      measures of learning. Quiz update: 70% previous mastery +
                      30% latest topic score. Tutor conversations record
                      exposure; they do not prove mastery.
                    </span>
                  </div>
                  <div className="stats spaced">
                    {[
                      [
                        "Strong areas",
                        topics.filter((t) => t.mastery >= 75).length,
                      ],
                      [
                        "In progress",
                        topics.filter((t) => t.mastery >= 50 && t.mastery < 75)
                          .length,
                      ],
                      [
                        "Needs practice",
                        topics.filter((t) => t.mastery < 50).length,
                      ],
                      ["Topics explored", studied.length],
                    ].map(([t, v]) => (
                      <div className="stat" key={t}>
                        <span>{t}</span>
                        <strong>{v}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="two-col">
                    <article className="card">
                      <h2>Quiz performance</h2>
                      {attempts.length ? (
                        <Suspense fallback={<div className="chart-loading" role="status">Loading quiz performance…</div>}><PerformanceChart attempts={attempts}/></Suspense>
                      ) : (
                        <div className="empty">
                          <ChartNoAxesCombined />
                          <h3>Your first result belongs here.</h3>
                          <p>Complete a quiz to start your progress story.</p>
                        </div>
                      )}
                    </article>
                    <article className="card">
                      <h2>Study activity</h2>
                      <div className="activity-list">
                        {activity.slice(0, 5).map((a, i) => (
                          <p key={i}>{a}</p>
                        ))}
                      </div>
                      <p>
                        {attempts.length} saved quiz attempts shown (latest
                        100).
                      </p>
                    </article>
                  </div>
                  <div className="topic-table card spaced">
                    <div className="section-title">
                      <h2>Topic mastery</h2>
                      <span className="badge">{topics.length} saved topics</span>
                    </div>
                    {topics.map((t) => (
                      <div className="mastery-row" key={t.id}>
                        <div>
                          <h3>{t.name}</h3>
                          <small>
                            {t.last} · {t.attempts} answered questions
                          </small>
                        </div>
                        <div>
                          <div className="row spread">
                            <small>
                              {t.mastery >= 75
                                ? "Strong area"
                                : t.mastery >= 50
                                  ? "In progress"
                                  : "Needs practice"}
                            </small>
                            <b>{t.mastery}%</b>
                          </div>
                          <Meter value={t.mastery} />
                        </div>
                        <span className="muted">
                          Accuracy:{" "}
                          {t.attempts
                            ? Math.round((t.correct / t.attempts) * 100) + "%"
                            : "—"}
                        </span>
                        <button className="btn" onClick={() => practice(t.id)}>
                          Practice
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {page === "revision" && (
                <Revision
                  topics={weak}
                  practice={practice}
                  source={setSource}
                  reviewed={reviewed}
                  onReview={(id: string) =>
                    save("revision", "POST", { topic: id })
                  }
                />
              )}
              {page === "evaluation" && <Evaluation />}
              {page === "settings" && (
                <>
                  {heading(
                    "Make this space yours.",
                    "Manage your profile and understand how your information is used.",
                  )}
                  <div className="two-col">
                    <article className="card">
                      <h2>Student profile</h2>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          save("profile", "PATCH", { name }).then(
                            (ok) => ok && toast.success("Profile saved"),
                          );
                        }}
                      >
                        <label className="field spaced">
                          <span>Your name</span>
                          <input
                            required
                            maxLength={40}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                          />
                        </label>
                        <button disabled={saving} className="btn primary spaced">
                          {saving ? "Saving…" : "Save profile"}
                        </button>
                      </form>
                      {authProvider === "password" && <PasswordSettings/>}
                    </article>
                    <article className="card">
                      <h2>Privacy & AI</h2>
                      {authProvider === "password" ? <button className="btn" onClick={async () => {
                        try {await api("auth/logout", "POST"); window.dispatchEvent(new Event("studymate:session-expired")); location.hash = "signin";}
                        catch(error: any) {toast.error(error.message);}
                      }}>Sign out</button> : <a className="btn" href="/signout-with-chatgpt?return_to=%2F" target="_top">Sign out</a>}
                      <p>
                        Your identity protects saved courses, uploads,
                        conversations and progress. Material deletion removes
                        related learning records and course conversations.
                      </p>
                      <p>
                        PDF and text extraction runs on the server. Tutor and AI
                        quiz requests send selected excerpts to Gemini when
                        configured. Video imports use Gemini extraction or the transcript you provide. Review AI-extracted text against the original video.
                      </p>
                      <button
                        className="btn spaced"
                        onClick={() => {
                          const blob = new Blob(
                            [
                              JSON.stringify(
                                {
                                  version: 1,
                                  name,
                                  topics,
                                  attempts,
                                  activity,
                                },
                                null,
                                2,
                              ),
                            ],
                            { type: "application/json" },
                          );
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = "studymate-session.json";
                          a.click();
                          setTimeout(() => URL.revokeObjectURL(url), 1000);
                        }}
                      >
                        <Download size={16} />
                        Export progress report
                      </button>
                    </article>
                  </div>
                </>
              )}
              {(page === "welcome" || page === "signin") && (
                <Landing go={(p: string) => go(p === "signin" ? "dashboard" : p)} setName={setName} signin={false} />
              )}
            </>
          )}
        </main>
        <footer className="workspace-footer">
          StudyMate AI <span>Thoughtful learning, one topic at a time.</span>
          <button onClick={() => go("evaluation")}>Evaluation lab</button>
        </footer>
      </SidebarInset>
      <Source page={source} onClose={() => setSource(null)} />
      <UploadModal
        open={upload}
        close={() => setUpload(false)}
        courses={courses}
        course={course}
        setCourse={setCourse}
        onAdd={refresh}
        videoAvailable={videoAvailable}
        aiAvailable={aiAvailable}
        limits={limits}
      />
      <Modal
        open={create}
        onClose={() => setCreate(false)}
        title="Make room for a new subject"
        description="Give your course a name. You can add its materials next."
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const c = courseName.trim();
            if (!c) return;
            if (courses.some((x) => x.toLowerCase() === c.toLowerCase())) {
              toast.error("A course with this name already exists.");
              return;
            }
            if (await save("courses", "POST", { name: c })) {
              setCourse(c);
              setCourseName("");
              setCreate(false);
              toast.success("Course created");
            }
          }}
        >
          <label className="field">
            <span>Course name</span>
            <input
              required
              maxLength={80}
              placeholder="e.g. Engineering Mathematics"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
            />
          </label>
          <button disabled={saving} className="btn primary spaced">{saving ? "Creating…" : "Create course"}</button>
        </form>
      </Modal>
    </>
  );
}
