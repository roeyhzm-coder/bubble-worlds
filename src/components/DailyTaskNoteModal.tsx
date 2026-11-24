import { AnimatePresence, motion } from "framer-motion";
import { FileText, Flag, Star, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDialogFocus, useEscape } from "../lib/useEscape";
import type { DailyTask } from "../types";
import { Portal } from "./Portal";

interface DailyTaskNoteModalProps {
  /** The task being edited; null closes the modal. */
  task: DailyTask | null;
  /** 1-based slot number shown in the header badge. */
  slot: number;
  onSave: (id: string, details: { text: string; notes: string; is_important: boolean }) => void;
  onClose: () => void;
}

/**
 * "פתק משימה": a roomy editor for a daily task's title and long notes. The draft is saved on
 * every way out (Save, X, backdrop, Escape) and when the app is backgrounded, so typed text is
 * never lost. The backdrop is sized to window.visualViewport and the panel is top-anchored, so
 * with the soft keyboard open the whole panel, including Save in its header, stays above it.
 */
export function DailyTaskNoteModal({ task, slot, onSave, onClose }: DailyTaskNoteModalProps) {
  const open = task !== null;
  const panel = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [notes, setNotes] = useState("");
  const [important, setImportant] = useState(false);
  const [openedId, setOpenedId] = useState<string | null>(null);
  const viewport = useVisualViewport(open);

  // Each opening starts from the saved task (set during render so no frame shows a stale draft).
  if ((task?.id ?? null) !== openedId) {
    setOpenedId(task?.id ?? null);
    if (task) {
      setText(task.text);
      setNotes(task.notes ?? "");
      setImportant(Boolean(task.is_important));
    }
  }

  const draft = useRef({ id: "", text: "", notes: "", important: false });
  draft.current = { id: task?.id ?? "", text, notes, important };
  const saveRef = useRef(onSave);
  saveRef.current = onSave;

  const flush = useCallback(() => {
    const { id, text: title, notes: body, important: flagged } = draft.current;
    if (id) saveRef.current(id, { text: title, notes: body, is_important: flagged });
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

  // The title grows past its 2 rows for long names, up to its max-height (then it scrolls).
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [text, open]);

  const starred = Boolean(task?.is_black_star);
  const hasNotes = notes.trim().length > 0;
  // A Black Star supersedes "important"; an untitled task can't be flagged (saved as off).
  const canFlag = !starred && text.trim().length > 0;
  const flagged = canFlag && important;

  return (
    <Portal>
      <AnimatePresence>
        {open && (
          <motion.div
            // Exactly the visible viewport: with the keyboard open this is the space above it.
            // Top padding clears the status bar (env(safe-area-inset-top) reads 0 in the Galaxy WebAPK).
            className="fixed inset-x-0 z-[80] flex items-start justify-center bg-slate-950/50 px-3 pt-[max(2.75rem,env(safe-area-inset-top))] backdrop-blur-[2px] sm:items-center sm:p-6"
            style={{ top: viewport.offsetTop, height: viewport.height }}
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
              initial={{ y: -12, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -8, opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              className={`flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-slate-800 shadow-2xl outline-none ${
                // Keyboard closed: keep clear of the Android 3-button navigation bar.
                viewport.keyboardOpen ? "max-h-[calc(100%-0.5rem)]" : "max-h-[calc(100%-3.5rem)]"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className={`flex shrink-0 items-center justify-between gap-2 px-3 py-2.5 ${
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
                      className="shrink-0"
                      aria-label="משימת מיקוד"
                    />
                  )}
                  <FileText
                    size={16}
                    aria-hidden="true"
                    className={`shrink-0 ${starred ? "text-blue-200" : "text-amber-600"}`}
                  />
                  <span className="truncate">פתק משימה</span>
                </h3>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={close}
                    className="h-9 rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 px-4 text-sm font-extrabold text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_6px_14px_-8px_rgba(217,119,6,0.8)]"
                  >
                    שמור
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    className={`grid h-9 w-9 place-items-center rounded-full ${
                      starred ? "bg-white/10 text-blue-100 hover:bg-white/15" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                    aria-label="שמירה וסגירה"
                    title="סגירה"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-3.5">
                <label className="block shrink-0">
                  <span className="sr-only">כותרת המשימה</span>
                  <textarea
                    ref={titleRef}
                    value={text}
                    rows={2}
                    onChange={(e) => setText(e.target.value.replace(/\n/g, " "))}
                    onKeyDown={(e) => {
                      // Titles stay one logical line: Enter jumps to the details field.
                      if (e.key === "Enter") {
                        e.preventDefault();
                        panel.current?.querySelector<HTMLTextAreaElement>("[data-notes]")?.focus();
                      }
                    }}
                    placeholder="כותרת המשימה..."
                    className="block max-h-28 w-full resize-none rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-base font-bold leading-snug text-slate-800 outline-none placeholder:text-slate-400 focus:border-amber-300 focus:bg-white focus:ring-2 focus:ring-amber-200/60"
                  />
                </label>
                <label className="flex min-h-[140px] flex-1 flex-col">
                  <span className="sr-only">פירוט המשימה</span>
                  <textarea
                    data-notes
                    data-autofocus
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="פירוט, שלבים או הערות למשימה..."
                    className="block min-h-[140px] w-full flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base leading-relaxed text-slate-700 outline-none placeholder:text-slate-400 focus:border-amber-300 focus:ring-2 focus:ring-amber-200/60"
                  />
                </label>
              </div>

              {(hasNotes || !starred) && (
                <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 px-2 pb-2 pt-1">
                  {!starred ? (
                    <button
                      type="button"
                      onClick={() => setImportant((value) => !value)}
                      disabled={!canFlag}
                      aria-pressed={flagged}
                      title={canFlag ? undefined : "יש להזין כותרת כדי לסמן כחשובה"}
                      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-extrabold transition-colors disabled:opacity-40 ${
                        flagged
                          ? "border-orange-500 bg-orange-500 text-white shadow-[0_6px_14px_-8px_rgba(234,88,12,0.9)]"
                          : "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
                      }`}
                    >
                      <Flag
                        size={13}
                        aria-hidden="true"
                        className={flagged ? "fill-white text-white" : "fill-orange-500 text-orange-500"}
                      />
                      {flagged ? "משימה חשובה" : "סמן כחשובה"}
                    </button>
                  ) : (
                    <span />
                  )}
                  {hasNotes && (
                  <button
                    type="button"
                    onClick={() => setNotes("")}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-extrabold text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 size={13} aria-hidden="true" />
                    נקה פתק
                  </button>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}

interface VisualViewportBox {
  height: number;
  offsetTop: number;
  keyboardOpen: boolean;
}

function readViewport(): { height: number; offsetTop: number } {
  if (typeof window === "undefined") return { height: 0, offsetTop: 0 };
  const vv = window.visualViewport;
  return { height: vv?.height ?? window.innerHeight, offsetTop: vv?.offsetTop ?? 0 };
}

/**
 * The visible viewport while `active`. The Android soft keyboard shrinks visualViewport.height;
 * `keyboardOpen` compares it with the tallest height seen since opening / the last rotation
 * (innerHeight alone can't tell: with interactive-widget=resizes-content it shrinks too).
 */
function useVisualViewport(active: boolean): VisualViewportBox {
  const [box, setBox] = useState<VisualViewportBox>(() => ({ ...readViewport(), keyboardOpen: false }));
  const tallest = useRef(0);

  useEffect(() => {
    if (!active) return;
    const vv = window.visualViewport;
    let frame = 0;
    const measure = () => {
      const next = readViewport();
      tallest.current = Math.max(tallest.current, next.height);
      const keyboardOpen = tallest.current - next.height > 120;
      setBox((prev) =>
        prev.height === next.height && prev.offsetTop === next.offsetTop && prev.keyboardOpen === keyboardOpen
          ? prev
          : { ...next, keyboardOpen },
      );
    };
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };
    const onRotate = () => {
      tallest.current = 0;
      update();
    };
    tallest.current = 0;
    measure();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", onRotate);
    return () => {
      window.cancelAnimationFrame(frame);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", onRotate);
    };
  }, [active]);

  return box;
}
