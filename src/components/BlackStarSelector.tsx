import { AnimatePresence, motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDialogFocus, useEscape } from "../lib/useEscape";
import { useApp } from "../state/AppProvider";
import type { Bubble, TriangleType } from "../types";
import { Portal } from "./Portal";

interface BlackStarSelectorProps {
  open: boolean;
  groups: { type: TriangleType; items: Bubble[] }[];
  onClose: () => void;
}

/** Central picker for the hub's black-star (Obsidian) zone: any number of items, including none. */
export function BlackStarSelector({ open, groups, onClose }: BlackStarSelectorProps) {
  const { setBlackStars } = useApp();
  const panel = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<Set<string>>(() => new Set());
  useEscape(open, onClose);
  useDialogFocus(open, panel);

  // Each opening starts from the saved selection; edits stay a draft until "שמירה".
  useEffect(() => {
    if (!open) return;
    setDraft(new Set(groups.flatMap(({ items }) => items.filter((item) => item.is_black_star).map((item) => item.id))));
  }, [open]);

  const toggle = (id: string) =>
    setDraft((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = () => {
    setBlackStars([...draft]);
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
              aria-labelledby="black-star-title"
              tabIndex={-1}
              dir="rtl"
              initial={{ y: 18, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 12, opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              className="flex max-h-[min(84dvh,36rem)] w-full max-w-sm flex-col overflow-hidden rounded-3xl border border-slate-700/60 bg-gradient-to-b from-slate-900 to-slate-950 text-slate-100 shadow-2xl outline-none"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-2 px-4 pb-2 pt-4">
                <div className="min-w-0">
                  <h3 id="black-star-title" className="flex items-center gap-1.5 text-base font-extrabold">
                    <span className="text-amber-300" aria-hidden="true">★</span>
                    ניהול מיקוד שחור
                  </h3>
                  <p className="mt-0.5 text-[11px] font-bold text-slate-400">
                    בחרו פריט אחד, כמה, או אף אחד — הם יוצמדו לראש המעקב
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-slate-300 hover:bg-white/15"
                  aria-label="סגירה"
                  title="סגירה"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 pb-2 no-scrollbar">
                {groups.length === 0 && (
                  <div className="rounded-2xl bg-white/5 px-3 py-6 text-center text-[12px] font-bold text-slate-400">
                    אין עדיין פריטים פעילים במעקב
                  </div>
                )}
                {groups.map(({ type, items }) => (
                  <div key={type.id}>
                    <div className="mb-1 flex items-center gap-1.5 px-1 text-[11px] font-extrabold text-slate-400">
                      <span style={{ color: type.color }} aria-hidden="true">▼</span>
                      {type.name}
                    </div>
                    <div className="space-y-1">
                      {items.map((item) => {
                        const checked = draft.has(item.id);
                        return (
                          <label
                            key={item.id}
                            className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border px-3 transition-colors ${
                              checked
                                ? "border-amber-300/50 bg-amber-300/10"
                                : "border-white/5 bg-white/[0.03] hover:bg-white/[0.07]"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggle(item.id)}
                              className="peer sr-only"
                            />
                            <span
                              aria-hidden="true"
                              className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-amber-300/60 ${
                                checked ? "border-amber-300 bg-amber-300 text-slate-950" : "border-slate-500"
                              }`}
                            >
                              {checked && <Check size={13} strokeWidth={3} />}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[13px] font-bold">
                              {item.title || "ללא שם"}
                            </span>
                            {checked && <span className="text-sm text-amber-300" aria-hidden="true">★</span>}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 border-t border-white/10 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
                <button
                  type="button"
                  onClick={() => setDraft(new Set())}
                  disabled={draft.size === 0}
                  className="h-11 rounded-xl px-3 text-[12px] font-extrabold text-slate-400 hover:bg-white/5 disabled:opacity-40"
                >
                  נקה הכל
                </button>
                <button
                  type="button"
                  onClick={save}
                  data-autofocus
                  className="h-11 flex-1 rounded-xl bg-gradient-to-b from-amber-300 to-amber-400 text-sm font-extrabold text-slate-950 shadow-[0_8px_20px_-10px_rgba(251,191,36,0.7)]"
                >
                  שמירה{draft.size > 0 ? ` · ${draft.size} ★` : ""}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
