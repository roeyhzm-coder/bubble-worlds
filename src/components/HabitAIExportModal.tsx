import { Bot, Check, ClipboardCopy, Download } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { todayKey } from "../lib/defaults";
import { buildHabitReport, collectHabits, summarizeHabits } from "../lib/habitReport";
import { useApp } from "../state/AppProvider";
import { ViewportModal } from "./ViewportModal";

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

function downloadText(text: string, filename: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 1000);
}

function Badge({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-50 px-2 py-1.5 text-center ring-1 ring-slate-100">
      <div className="truncate text-[15px] font-black text-slate-800">{value}</div>
      <div className="truncate text-[10px] font-bold text-slate-400">{label}</div>
    </div>
  );
}

/** "ייצוא ל-AI": a Hebrew habit-stack report to paste into an AI chat, or save as .txt. */
export function HabitAIExportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { snapshot } = useApp();
  const [candidate, setCandidate] = useState("");
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  const timer = useRef<number | null>(null);
  const today = todayKey();

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const summary = useMemo(() => summarizeHabits(collectHabits(snapshot, today)), [snapshot, today]);
  const report = useMemo(
    () => (open ? buildHabitReport(snapshot, today, candidate) : ""),
    [candidate, open, snapshot, today],
  );

  const copy = async () => {
    const ok = await copyText(report);
    setCopied(ok ? "ok" : "fail");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(null), 1800);
  };

  return (
    <ViewportModal
      open={open}
      onClose={onClose}
      titleId="habit-ai-export-title"
      title={
        <>
          <Bot size={17} className="shrink-0 text-violet-500" />
          ייצוא ל-AI
        </>
      }
      toolbar={
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => void copy()}
            className={`inline-flex h-11 min-w-0 flex-[2] items-center justify-center gap-1.5 rounded-xl px-3 text-[13px] font-extrabold text-white shadow-sm ${
              copied === "ok" ? "bg-emerald-600" : copied === "fail" ? "bg-rose-600" : "bg-violet-600"
            }`}
          >
            {copied === "ok" ? <Check size={16} /> : <ClipboardCopy size={16} />}
            {copied === "ok" ? "הועתק!" : copied === "fail" ? "ההעתקה נכשלה — נסו הורדה" : 'העתק דו"ח מלא ל-AI'}
          </button>
          <button
            type="button"
            onClick={() => downloadText(report, `bubble-worlds-habits-${today}.txt`)}
            className="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl bg-white px-3 text-[12px] font-extrabold text-slate-700 ring-1 ring-slate-200"
          >
            <Download size={15} />
            הורד (.txt)
          </button>
        </div>
      }
    >
      <label className="block">
        <span className="text-[12px] font-extrabold text-slate-600">שוקל להוסיף הרגל חדש? (אופציונלי)</span>
        <input
          value={candidate}
          onChange={(e) => setCandidate(e.target.value)}
          placeholder="לדוגמה: קריאת ספר 20 דקות בערב"
          maxLength={300}
          enterKeyHint="done"
          className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none focus:border-transparent focus:bg-white focus:ring-2 focus:ring-violet-200"
        />
      </label>

      <div className="mt-3 grid grid-cols-4 gap-1.5">
        <Badge label="הרגלים" value={String(summary.habits)} />
        <Badge label="תחומים" value={String(summary.topics)} />
        <Badge label="דק׳ בשבוע" value={String(summary.weeklyMinutes)} />
        <Badge label="עמידה ביעד" value={summary.adherence === null ? "—" : `${summary.adherence}%`} />
      </div>

      <div className="mt-3 text-[11px] font-bold text-slate-400">תצוגה מקדימה</div>
      <pre
        dir="rtl"
        className="mt-1 max-h-[45vh] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 font-sans text-[12px] leading-relaxed text-slate-700 ring-1 ring-slate-100"
      >
        {report}
      </pre>
    </ViewportModal>
  );
}
