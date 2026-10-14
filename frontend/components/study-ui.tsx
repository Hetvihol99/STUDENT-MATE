"use client";
import { ReactNode, useState, useEffect } from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { FileText, BookOpen, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { initialTopics, type SourceRef } from "@/lib/demo";
import { api } from "@/lib/api-client";
export function Pick({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: (string | { value: string; label: string })[];
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="picker" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => {
            const v = typeof o === "string" ? o : o.value;
            return (
              <SelectItem key={v} value={v}>
                {typeof o === "string" ? o : o.label}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </label>
  );
}
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="study-modal">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          {description || "Manage your learning workspace."}
        </DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}
export function Source({
  page,
  onClose,
}: {
  page: number | SourceRef | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [section, setSection] = useState(1);
  useEffect(() => {setSection(typeof page === "number" ? page : page?.page || 1);}, [page]);
  useEffect(() => {
    let current = true;
    setData(null); setError("");
    if (page && typeof page !== "number")
      api("materials/" + page.materialId + "/pages?page=" + section)
        .then(d => current && setData(d))
        .catch(e => current && setError(e.message));
    return () => {current = false;};
  }, [page, section]);
  const stamp = /^\[(\d+):(\d+)\]/.exec(data?.text || "");
  const seconds = stamp ? Number(stamp[1]) * 60 + Number(stamp[2]) : 0;
  const video = data?.type === "Video" || data?.type === "YouTube";
  const t =
    typeof page === "number"
      ? initialTopics.find((t) => t.page === section)
      : null;
  return (
    <Sheet open={page !== null} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="source-sheet">
        <SheetTitle>Check the source</SheetTitle>
        <SheetDescription>
          {t
            ? "Prepared DBMS notes"
            : "Your saved material · extracted source text"}
        </SheetDescription>
        {error && <p role="alert">{error}</p>}
        {page && (
          <>
            <a
              className="btn"
              href={typeof page === "number" ? "/dbms-unit-1.pdf#page=" + section
                : data?.type === "YouTube" ? data.videoUrl + (seconds ? "&t=" + seconds : "")
                : `/api/study/materials/${page.materialId}/file#${video ? "t=" + seconds : "page=" + section}`}
              target="_blank"
              rel="noreferrer"
            >
              Open original
              <ExternalLink size={14} />
            </a>
            {data?.type === "Video" && <video className="study-video" controls preload="metadata" src={`/api/study/materials/${data.materialId}/file#t=${seconds}`}>Your browser cannot play this video. Open the original file instead.</video>}
            {data?.type === "YouTube" && data.videoUrl && <iframe className="study-video" title="YouTube lesson" src={`https://www.youtube-nocookie.com/embed/${new URL(data.videoUrl).searchParams.get("v")}?start=${seconds}`} loading="lazy" allow="encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>}
            {data?.transcriptSource && <p className="video-help">{data.transcriptSource === "ai" ? "AI-extracted study text. Verify it against the original lesson." : "Study text from your provided transcript."}</p>}
            {data?.pages > 1 && <div className="source-navigation row spread"><button className="btn" disabled={section <= 1} onClick={() => setSection(n => n - 1)} aria-label="Previous source section"><ChevronLeft size={16}/>Previous</button><span>{video ? "Section" : "Page"} {section} of {data.pages}</span><button className="btn" disabled={section >= data.pages} onClick={() => setSection(n => n + 1)} aria-label="Next source section">Next<ChevronRight size={16}/></button></div>}
            <div className="source-paper">
              <h2>{t?.name || data?.title || "Loading source…"}</h2>
              <small>{video ? "Section" : "Page"} {section}</small>
              <p style={{ whiteSpace: "pre-wrap" }}>
                {t ? t.text + "\n\n" + t.example : data?.text}
              </p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
export function Citation({
  page,
  onOpen,
  materialId,
  title,
}: {
  page: number;
  onOpen: (n: any) => void;
  materialId?: string;
  title?: string;
}) {
  return (
    <button
      className="citation"
      onClick={() => onOpen(materialId ? { materialId, page, title } : page)}
    >
      <FileText size={15} />
      {title || "DBMS learning notes"} <span>· p. {page}</span>
    </button>
  );
}
export function Meter({ value, label }: { value: number; label?: string }) {
  return (
    <Progress
      className={value < 50 ? "weak-meter" : value >= 75 ? "strong-meter" : ""}
      value={value}
      aria-label={label || `${value}% estimated mastery`}
    />
  );
}
