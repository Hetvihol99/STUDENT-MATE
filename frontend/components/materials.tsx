"use client";
import { useState, useEffect } from "react";
import {
  Search,
  Grid2X2,
  List,
  FileText,
  Trash2,
  Pencil,
  FolderOpen,
  Upload,
  Video,
  Play,
  Link,
} from "lucide-react";
import { toast } from "sonner";
import { Pick, Modal } from "@/components/study-ui";
import { Material } from "@/lib/demo";
import { api } from "@/lib/api-client";
export function LibraryView({
  materials,
  refresh,
  courses,
  course,
  setCourse,
  source,
  upload,
  go,
}: any) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All formats");
  const [sort, setSort] = useState("Newest first");
  const [grid, setGrid] = useState(true);
  const [rename, setRename] = useState<Material | null>(null);
  const [newName, setNewName] = useState("");
  const [remove, setRemove] = useState<Material | null>(null);
  const [busy, setBusy] = useState(false);
  const shown = (materials as Material[])
    .filter(
      (m) =>
        (course === "All courses" || m.course === course) &&
        (filter === "All formats" || m.type === filter) &&
        m.name.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "Name A–Z"
        ? a.name.localeCompare(b.name)
        : b.date.localeCompare(a.date),
    );
  async function mutate(path: string, method: string, body?: unknown) {
    setBusy(true);
    try {
      await api(path, method, body);
      setRename(null);
      setRemove(null);
      await refresh();
      toast.success("Library saved");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="library-toolbar">
        <div className="search-box">
          <Search size={17} />
          <input
            aria-label="Search materials"
            placeholder="Search your materials…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Pick
          label="Course filter"
          value={course}
          onChange={setCourse}
          options={["All courses", ...courses]}
        />
        <Pick
          label="File type"
          value={filter}
          onChange={setFilter}
          options={["All formats", "PDF", "Text", "Video", "YouTube"]}
        />
        <Pick
          label="Sort"
          value={sort}
          onChange={setSort}
          options={["Newest first", "Name A–Z"]}
        />
        <div className="row">
          <button
            className="btn"
            aria-label="Grid view"
            aria-pressed={grid}
            onClick={() => setGrid(true)}
          >
            <Grid2X2 size={17} />
          </button>
          <button
            className="btn"
            aria-label="List view"
            aria-pressed={!grid}
            onClick={() => setGrid(false)}
          >
            <List size={17} />
          </button>
        </div>
      </div>
      <div className="row spread spaced">
        <span className="muted">{shown.length} materials</span>
        <button className="text-button" onClick={() => go("knowledge")}>
          Explore knowledge base
        </button>
      </div>
      {!shown.length ? (
        <div className="empty card spaced">
          <FolderOpen size={35} />
          <h2>{materials.length ? "No matching materials." : "Your next idea starts here."}</h2>
          <p>{materials.length ? "Try a different search or reset your filters." : "Create a course for your notes, or load the sample to get started."}</p>
          {materials.length > 0 && <button className="btn" onClick={() => {setQuery(""); setFilter("All formats"); setCourse("All courses");}}>Reset filters</button>}
          <button className="btn primary" onClick={upload}>
            Add material
          </button>
        </div>
      ) : (
        <div className={grid ? "material-grid" : "material-list"}>
          {shown.map((m) => (
            <article className="card material-card" key={m.id}>
              <div className="row spread">
                <div className="file-icon">
                  {m.type === "YouTube" ? <Play size={25}/> : m.type === "Video" ? <Video size={25}/> : <FileText size={25} />}
                  <small>{m.type}</small>
                </div>
                <span
                  className={`badge ${m.status === "Ready to study" ? "green" : "amber"}`}
                >
                  {m.status}
                </span>
              </div>
              <button
                className="material-title"
                disabled={m.status !== "Ready to study"}
                onClick={() =>
                  source({ materialId: m.id, page: 1, title: m.name })
                }
              >
                {m.name}
              </button>
              <p>{m.course}</p>
              <small>
                Added {m.date.slice(0, 10)} · {m.pages || 0} {m.type === "Video" || m.type === "YouTube" ? (m.pages === 1 ? "section" : "sections") : (m.pages === 1 ? "page" : "pages")}{" "}
                {m.seeded ? "· Sample dataset" : ""}
              </small>
              {m.transcriptSource && <small className="transcript-note">{m.transcriptSource === "ai" ? "AI-extracted study text · check against video" : "Your provided transcript"}</small>}
              {m.error && <p className="error">{m.error}</p>}
              <div className="material-actions">
                <a
                  className="text-button"
                  href={m.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {m.type === "YouTube" ? "Watch on YouTube" : m.type === "Video" ? "Open video" : "Original file"}
                </a>
                <div className="row">
                  <button
                    aria-label={`Rename ${m.name}`}
                    onClick={() => {
                      setRename(m);
                      setNewName(m.name);
                    }}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    aria-label={`Delete ${m.name}`}
                    onClick={() => setRemove(m)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <Modal
        open={!!rename}
        onClose={() => setRename(null)}
        title="Rename material"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutate("materials/" + rename?.id, "PATCH", { name: newName });
          }}
        >
          <label className="field">
            <span>Material name</span>
            <input
              value={newName}
              maxLength={120}
              required
              onChange={(e) => setNewName(e.target.value)}
            />
          </label>
          <button disabled={busy} className="btn primary spaced">
            Save name
          </button>
        </form>
      </Modal>
      <Modal
        open={!!remove}
        onClose={() => setRemove(null)}
        title="Delete this material?"
        description="Deletes the stored file, extracted text, related quizzes and progress, revision cards, and conversations in this course. Your computer’s original file stays intact."
      >
        <button
          disabled={busy}
          className="btn danger"
          onClick={() => mutate("materials/" + remove?.id, "DELETE")}
        >
          {busy ? "Deleting…" : "Delete material"}
        </button>
      </Modal>
    </>
  );
}
export function UploadModal({open, close, courses, course, setCourse, onAdd, videoAvailable = false, aiAvailable = false, limits = {uploadMb:5,videoMb:50,videoMinutes:60}}: any) {
  const [mode, setMode] = useState("document");
  const [selected, setSelected] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {setSelected(null); setError(""); setMode("document"); setUrl(""); setTitle(""); setTranscript("");}
  }, [open]);
  function choose(file?: File) {
    if (!file) return;
    setError(""); setSelected(null);
    const video = /\.(mp4|m4v|mov|webm)$/i.test(file.name);
    const max = video ? limits.videoMb : limits.uploadMb;
    if (!/\.(pdf|txt|md|mp4|m4v|mov|webm)$/i.test(file.name) || !file.size || file.size > max * 1024 * 1024 || (video && !videoAvailable)) {
      setError(`Choose a supported non-empty ${video ? "video" : "document"} up to ${max} MB.`); return;
    }
    setMode(video ? "video" : "document"); setSelected(file);
  }
  async function process(sample = false) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      if (sample) await api("seed", "POST", {});
      else {
        if (!courses.includes(course)) throw new Error("Choose an existing course first.");
        if (mode === "youtube") {
          await api("materials/youtube", "POST", {course, url, name:title.trim(), transcript});
        } else {
          if (!selected) throw new Error("Choose a file first.");
          const form = new FormData(); form.set("course", course); form.set("file", selected);
          if (mode === "video" && transcript.trim()) form.set("transcript", transcript);
          await api("materials", "POST", form);
        }
      }
      await onAdd(); toast.success(sample ? "Sample dataset saved" : "Material is ready to study"); close();
    } catch(error: any) {setError(error.message); await onAdd();}
    finally {setBusy(false);}
  }
  const media = mode !== "document";
  const unavailable = media && !aiAvailable && !transcript.trim();
  return <Modal open={open} onClose={() => !busy && close()} title="Bring your material along." description="Keep your notes, lessons and video study text together in a course.">
    {videoAvailable && <div className="material-tabs" aria-label="Material type">{[["document",FileText,"Document"],["video",Video,"Video upload"],["youtube",Play,"YouTube link"]].map(([value,Icon,label]: any) => <button type="button" key={value} disabled={busy} aria-pressed={mode === value} className={mode === value ? "selected" : ""} onClick={() => {setMode(value); setSelected(null); setError(""); setTranscript("");}}><Icon size={17}/>{label}</button>)}</div>}
    {!courses.length && <p className="notice">Create your first course from My Courses, or load the sample notes below.</p>}
    <Pick label="Add to course" value={course} onChange={setCourse} options={courses}/>
    {mode === "youtube" ? <>
      <label className="field"><span>YouTube video link</span><input type="url" value={url} disabled={busy} onChange={e => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…"/></label>
      <label className="field"><span>Lesson title (optional)</span><input value={title} disabled={busy} maxLength={120} onChange={e => setTitle(e.target.value)} placeholder="e.g. Database keys explained"/></label>
      <p className="video-help">Use a public video up to {limits.videoMinutes} minutes. Private videos and playlists cannot be processed automatically.</p>
    </> : <div className="dropzone" onDragOver={e => e.preventDefault()} onDrop={e => {e.preventDefault(); if (!busy) choose(e.dataTransfer.files[0]);}}>
      {mode === "video" ? <Video size={31}/> : <Upload size={31}/>}
      <h3>{selected?.name || (mode === "video" ? "Drop your lesson video here" : "Drop your notes here")}</h3>
      <p>{mode === "video" ? `MP4, M4V, WebM or MOV · up to ${limits.videoMb} MB` : `Text-based PDF, UTF-8 TXT or Markdown · up to ${limits.uploadMb} MB`}</p>
      <label className="btn"><input type="file" className="sr-only" aria-label="Browse files" disabled={busy} accept={mode === "video" ? ".mp4,.m4v,.webm,.mov" : ".pdf,.txt,.md"} onChange={e => {choose(e.target.files?.[0]); e.target.value = "";}}/>Browse files</label>
      {selected && <small>{(selected.size / 1024 / 1024).toFixed(1)} MB selected</small>}
    </div>}
    {media && <>
      <details className="transcript-input" open={!aiAvailable}><summary>Have a transcript? Paste it instead</summary><label className="field"><span>Transcript or accurate lesson notes</span><textarea disabled={busy} maxLength={80000} value={transcript} onChange={e => setTranscript(e.target.value)} placeholder="Paste the spoken lesson text here. Timestamps are welcome." rows={5}/></label><small>Provided text becomes the study source. This skips automatic video extraction.</small></details>
      <p className="notice">{aiAvailable ? "Without a pasted transcript, this video or link is sent to Gemini to extract study text. Check the result against the video before relying on it." : "Paste a transcript to study this video. Automatic extraction needs AI setup."}</p>
    </>}
    {mode === "document" && <button className="prepared-pick" disabled={busy} onClick={() => process(true)}><FileText size={20}/><span><b>Load sample DBMS Unit 1 notes</b><small>Prepared quizzes · no AI key needed</small></span></button>}
    {error && <p role="alert" className="error">{error}</p>}
    {busy && <p role="status">{media ? "Extracting study text… video processing can take a few minutes. Keep this window open." : "Saving and processing…"}</p>}
    <button className="btn primary" disabled={busy || !courses.includes(course) || (mode === "youtube" ? !url.trim() : !selected) || unavailable} onClick={() => process()}>{busy ? "Processing…" : mode === "youtube" ? "Add YouTube lesson" : mode === "video" ? "Upload video and study" : "Upload and process"}</button>
  </Modal>;
}
