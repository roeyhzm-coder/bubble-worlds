import { AnimatePresence, motion } from "framer-motion";
import { Check, Flag, X } from "lucide-react";
import { useRef, useState } from "react";
import { canBeImportant } from "../lib/daily";
import { useDialogFocus, useEscape } from "../lib/useEscape";
import { useApp } from "../state/AppProvider";
import type { DailyTask } from "../types";
import { Portal } from "./Portal";

interface DailyImportantSelectorProps {
  open: boolean;
  /** The day being viewed; only its tasks are flagged or unflagged. */
  date: string;
  tasks: DailyTask[];
  onClose: () => void;
}

/**
 * Picks the day's important tasks (0, 1 or many). Black Star tasks are not listed: the star
 * supersedes "important". Edits stay a draft until "שמירה".
 */
export function DailyImportantSelector({ open, date, tasks, onClose }: DailyImportantSelectorProps) {
  const { setDailyImportant } = useApp();
  const panel = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<Set<string>>(() => new Set());
  const [wasOpen, setWasOpen] = useState(false);
  useEscape(open, onClose);
  useDialogFocus(open, panel);

  // Each opening starts from the saved flags (set during render so no frame shows a stale draft).
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(new Set(tasks.filter((task) => task.is_important).map((task) => task.id)));
  }

  const choices = tasks.filter(canBeImportant);
  const selected = choices.filter((task) => draft.has(task.id)).length;

  const toggle = (id: string) =>
    setDraft((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = () => {
    setDailyImportant(date, choices.filter((task) => draft.has(task.id)).map((task) => task.id));
    onClose();
  };

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
              aria-labelledby="daily-important-title"
              tabIndex={-1}
              dir="rtl"
              initial={{ y: 18, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 12, opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              className="flex max-h-[min(84dvh,36rem)] w-full max-w-sm flex-col overflow-hidden rounded-3xl border border-orange-200 bg-white text-slate-800 shadow-2xl outline-none"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-2 border-b border-orange-100 bg-gradient-to-b from-orange-50 to-white px-4 pb-2.5 pt-4">
                <div className="min-w-0">
                  <h3 id="daily-important-title" className="flex items-center gap-1.5 text-base font-extrabold">
                    <Flag size={17} className="fill-orange-500 text-orange-500" aria-hidden="true" />
                    משימות חשובות
                  </h3>
                  <p className="mt-0.5 text-[11px] font-bold text-slate-500">
                    סמנו משימות בעדיפות גבוהה — הן נשארות ברשימה וניתנות לגרירה
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
                  aria-label="סגירה"
                  title="סגירה"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-2 no-scrollbar">
                {choices.length === 0 && (
                  <div className="rounded-2xl bg-slate-50 px-3 py-6 text-center text-[12px] font-bold text-slate-400">
                    אין משימות רגילות עם טקסט ליום הזה
                  </div>
                )}
                {choices.map((task) => {
                  const checked = draft.has(task.id);
                  return (
                    <label
                      key={task.id}
                      className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border px-3 transition-colors ${
                        checked
                          ? "border-orange-300 border-r-4 border-r-orange-500 bg-orange-50"
                          : "border-slate-200/80 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <input type="checkbox" checked={checked} onChange={() => toggle(task.id)} className="peer sr-only" />
                      <span
                        aria-hidden="true"
                        className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-orange-300 ${
                          checked ? "border-orange-500 bg-orange-500 text-white" : "border-slate-300 bg-white"
                        }`}
                      >
                        {checked && <Check size={13} strokeWidth={3} />}
                      </span>
                      <span
                        className={`min-w-0 flex-1 truncate text-[13px] font-bold ${
                          task.completed ? "text-slate-400 line-through" : ""
                        }`}
                      >
                        {task.text.trim()}
                      </span>
                      {checked && <Flag size={14} className="shrink-0 fill-orange-500 text-orange-500" aria-hidden="true" />}
                    </label>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 border-t border-slate-100 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
                <button
                  type="button"
                  onClick={() => setDraft(new Set())}
                  disabled={selected === 0}
                  className="h-11 rounded-xl px-3 text-[12px] font-extrabold text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                >
                  נקה הכל
                </button>
                <button
                  type="button"
                  onClick={save}
                  data-autofocus
                  className="h-11 flex-1 rounded-xl bg-gradient-to-b from-orange-500 to-orange-600 text-sm font-extrabold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_8px_20px_-10px_rgba(234,88,12,0.8)]"
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
