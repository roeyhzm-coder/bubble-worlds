import { AnimatePresence, motion } from "framer-motion";
import { FileText, Star, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDialogFocus, useEscape } from "../lib/useEscape";
import type { DailyTask } from "../types";
import { Portal } from "./Portal";

interface DailyTaskNoteModalProps {
  /** The task being edited; null closes the modal. */
  task: DailyTask | null;
  /** 1-based slot number shown in the header badge. */
  slot: number;
  onSave: (id: string, details: { text: string; notes: string }) => void;
  onClose: () => void;
}

/**
 * "פתק משימה": a roomy editor for a daily task's title and long notes. The draft is saved on
 * every way out (save button, X, backdrop, Escape) and when the app is backgrounded, so typed
 * text is never lost. The viewport uses interactive-widget=resizes-content, so 85dvh shrinks
 * with the soft keyboard and the panel stays scrollable above it.
 */
export function DailyTaskNoteModal({ task, slot, onSave, onClose }: DailyTaskNoteModalProps) {
  const open = task !== null;
  const panel = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [notes, setNotes] = useState("");
  const [openedId, setOpenedId] = useState<string | null>(null);

  // Each opening starts from the saved task (set during render so no frame shows a stale draft).
  if ((task?.id ?? null) !== openedId) {
    setOpenedId(task?.id ?? null);
    if (task) {
      setText(task.text);
      setNotes(task.notes ?? "");
    }
  }

  const draft = useRef({ id: "", text: "", notes: "" });
  draft.current = { id: task?.id ?? "", text, notes };
  const saveRef = useRef(onSave);
  saveRef.current = onSave;

  const flush = useCallback(() => {
    const { id, text: title, notes: body } = draft.current;
    if (id) saveRef.current(id, { text: title, notes: body });
  }, []);

  const close = useCallback(() => {
    flush();
    onClose();
  }, [flush, onClose]);

  useEscape(open, close);
  useDialogFocus(open, panel);

  // The PWA can be swiped away mid-edit: persist the draft whenever the page is hidden.
  useEffect(() => {
    if (!open) return;
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
    };
  }, [flush, open]);

  // Auto-grow the title so a long task name is fully visible.
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text, open]);

  const starred = Boolean(task?.is_black_star);
  const hasNotes = notes.trim().length > 0;

  return (
    <Portal>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/50 px-3 pb-3 pt-[max(2.75rem,env(safe-area-inset-top))] backdrop-blur-[2px] sm:items-center sm:pb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          >
            <motion.div
              ref={panel}
              role="dialog"
              aria-modal="true"
              aria-labelledby="daily-note-title"
              tabIndex={-1}
              dir="rtl"
              initial={{ y: 24, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 16, opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              className="flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white text-slate-800 shadow-2xl outline-none"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className={`flex shrink-0 items-center justify-between gap-2 px-4 py-3 ${
                  starred
                    ? "bg-gradient-to-r from-blue-950 to-indigo-950 text-blue-50"
                    : "border-b border-slate-100"
                }`}
              >
                <h3 id="daily-note-title" className="flex min-w-0 items-center gap-2 text-[15px] font-extrabold">
                  <span
                    className={`grid h-7 min-w-7 shrink-0 place-items-center rounded-full px-2 text-[12px] font-black ${
                      starred ? "bg-white/15 text-blue-50" : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {slot}
                  </span>
                  {starred && (
                    <Star
                      size={16}
                      fill="black"
                      color="rgba(255,255,255,0.5)"
                      strokeWidth={1.5}
                      aria-label="משימת מיקוד"
                    />
                  )}
                  <FileText size={16} aria-hidden="true" className={starred ? "text-blue-200" : "text-amber-600"} />
                  פתק משימה
                </h3>
                <button
                  type="button"
                  onClick={close}
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                    starred ? "bg-white/10 text-blue-100 hover:bg-white/15" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                  aria-label="שמירה וסגירה"
                  title="סגירה"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3">
                <label className="block">
                  <span className="sr-only">כותרת המשימה</span>
                  <textarea
                    ref={titleRef}
                    value={text}
                    rows={1}
                    onChange={(e) => setText(e.target.value.replace(/\n/g, " "))}
                    onKeyDown={(e) => {
                      // Titles stay one logical line: Enter jumps to the details field.
                      if (e.key === "Enter") {
                        e.preventDefault();
                        panel.current?.querySelector<HTMLTextAreaElement>("[data-notes]")?.focus();
                      }
                    }}
                    placeholder="כותרת המשימה..."
                    className="block w-full resize-none overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-base font-bold leading-snug text-slate-800 outline-none placeholder:text-slate-400 focus:border-amber-300 focus:bg-white focus:ring-2 focus:ring-amber-200/60"
                  />
                </label>
                <label className="block">
                  <span className="sr-only">פירוט המשימה</span>
                  <textarea
                    data-notes
                    data-autofocus
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="פירוט, שלבים או הערות למשימה..."
                    className="block min-h-[200px] w-full resize-y rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-base leading-relaxed text-slate-700 outline-none placeholder:text-slate-400 focus:border-amber-300 focus:ring-2 focus:ring-amber-200/60"
                  />
                </label>
              </div>

              <div className="flex shrink-0 items-center gap-2 border-t border-slate-100 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
                {hasNotes && (
                  <button
                    type="button"
                    onClick={() => setNotes("")}
                    className="inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-[12px] font-extrabold text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    נקה פתק
                  </button>
                )}
                <button
                  type="button"
                  onClick={close}
                  className="h-11 flex-1 rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 text-sm font-extrabold text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_8px_18px_-10px_rgba(217,119,6,0.8)]"
                >
                  שמור וסגור
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
