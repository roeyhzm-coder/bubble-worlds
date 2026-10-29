import { AnimatePresence, motion } from "framer-motion";
import { Check, Star, X } from "lucide-react";
import { useRef, useState } from "react";
import { useDialogFocus, useEscape } from "../lib/useEscape";
import { useApp } from "../state/AppProvider";
import type { DailyTask } from "../types";
import { Portal } from "./Portal";

interface DailyStarSelectorProps {
  open: boolean;
  /** The day being viewed; only its tasks are starred or unstarred. */
  date: string;
  tasks: DailyTask[];
  onClose: () => void;
}

/** Picks the day's focus tasks (0, 1 or many). Edits stay a draft until "שמירה". */
export function DailyStarSelector({ open, date, tasks, onClose }: DailyStarSelectorProps) {
  const { setDailyStars } = useApp();
  const panel = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<Set<string>>(() => new Set());
  const [wasOpen, setWasOpen] = useState(false);
  useEscape(open, onClose);
  useDialogFocus(open, panel);

  // Each opening starts from the saved stars (set during render so no frame shows a stale draft).
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(new Set(tasks.filter((task) => task.is_black_star).map((task) => task.id)));
  }

  const choices = tasks.filter((task) => task.text.trim());

  const toggle = (id: string) =>
    setDraft((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = () => {
    setDailyStars(date, choices.filter((task) => draft.has(task.id)).map((task) => task.id));
    onClose();
  };

  const selected = choices.filter((task) => draft.has(task.id)).length;

  return (
    <Portal>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/50 px-4 py-[max(1rem,env(safe-area-inset-top))] backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          >
            <motion.div
              ref={panel}
              role="dialog"
              aria-modal="true"
              aria-labelledby="daily-star-title"
              tabIndex={-1}
              dir="rtl"
              initial={{ y: 18, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 12, opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              className="flex max-h-[min(84dvh,36rem)] w-full max-w-sm flex-col overflow-hidden rounded-3xl border border-indigo-400/20 bg-gradient-to-b from-blue-950 to-indigo-950 text-blue-50 shadow-2xl outline-none"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-2 px-4 pb-2 pt-4">
                <div className="min-w-0">
                  <h3 id="daily-star-title" className="flex items-center gap-1.5 text-base font-extrabold">
                    <Star size={18} fill="black" color="rgba(255,255,255,0.45)" strokeWidth={1.5} aria-hidden="true" />
                    ניהול משימות מיקוד
                  </h3>
                  <p className="mt-0.5 text-[11px] font-bold text-blue-300/70">
                    בחרו משימה אחת, כמה, או אף אחת — הן יוצמדו לראש הרשימה
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-blue-100 hover:bg-white/15"
                  aria-label="סגירה"
                  title="סגירה"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 pb-2 no-scrollbar">
                {choices.length === 0 && (
                  <div className="rounded-2xl bg-white/5 px-3 py-6 text-center text-[12px] font-bold text-blue-300/70">
                    אין עדיין משימות עם טקסט ליום הזה
                  </div>
                )}
                {choices.map((task) => {
                  const checked = draft.has(task.id);
                  return (
                    <label
                      key={task.id}
                      className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border px-3 transition-colors ${
                        checked ? "border-blue-300/40 bg-white/10" : "border-white/5 bg-white/[0.03] hover:bg-white/[0.07]"
                      }`}
                    >
                      <input type="checkbox" checked={checked} onChange={() => toggle(task.id)} className="peer sr-only" />
                      <span
                        aria-hidden="true"
                        className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-blue-300/60 ${
                          checked ? "border-blue-200 bg-blue-100 text-blue-950" : "border-blue-300/40"
                        }`}
                      >
                        {checked && <Check size={13} strokeWidth={3} />}
                      </span>
                      <span
                        className={`min-w-0 flex-1 truncate text-[13px] font-bold ${
                          task.completed ? "text-blue-300/60 line-through" : ""
                        }`}
                      >
                        {task.text.trim()}
                      </span>
                      {checked && (
                        <Star size={16} fill="black" color="rgba(255,255,255,0.45)" strokeWidth={1.5} aria-hidden="true" />
                      )}
                    </label>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 border-t border-white/10 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
                <button
                  type="button"
                  onClick={() => setDraft(new Set())}
                  disabled={selected === 0}
                  className="h-11 rounded-xl px-3 text-[12px] font-extrabold text-blue-300/80 hover:bg-white/5 disabled:opacity-40"
                >
                  נקה הכל
                </button>
                <button
                  type="button"
                  onClick={save}
                  data-autofocus
                  className="h-11 flex-1 rounded-xl bg-white text-sm font-extrabold text-blue-950 shadow-[0_8px_20px_-10px_rgba(147,197,253,0.6)]"
                >
                  שמירה{selected > 0 ? ` · ${selected}` : ""}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
