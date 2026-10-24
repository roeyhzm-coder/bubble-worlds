import { AnimatePresence, motion } from "framer-motion";
import { Undo2, X } from "lucide-react";
import { useApp } from "../state/AppProvider";
import { Portal } from "./Portal";

/** Global 5-second "deleted / moved · undo" toast for destructive actions. */
export function UndoToast() {
  const { undoToast, undoLast, dismissUndo } = useApp();
  return (
    <Portal>
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 bottom-[calc(max(1.25rem,env(safe-area-inset-bottom))+4.25rem)] z-[75] flex justify-center"
      >
        <AnimatePresence>
          {undoToast && (
            <motion.div
              key={undoToast.id}
              role="status"
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ type: "spring", stiffness: 460, damping: 34 }}
              className="pointer-events-auto relative flex w-full max-w-sm items-center gap-2 overflow-hidden rounded-2xl bg-slate-900/95 py-2 pe-2 ps-4 text-white shadow-[0_18px_40px_-14px_rgba(15,23,42,0.7)] backdrop-blur"
            >
              <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{undoToast.label}</span>
              <button
                type="button"
                onClick={undoLast}
                className="inline-flex h-9 shrink-0 items-center gap-1 rounded-xl bg-white px-3 text-[12px] font-extrabold text-slate-900"
                aria-label="ביטול הפעולה האחרונה"
                title="ביטול הפעולה האחרונה"
              >
                בטל <Undo2 size={14} />
              </button>
              <button
                type="button"
                onClick={dismissUndo}
                className="grid h-9 w-8 shrink-0 place-items-center rounded-xl text-slate-400 hover:bg-white/10"
                aria-label="סגירת ההודעה"
                title="סגירה"
              >
                <X size={14} />
              </button>
              {/* Countdown bar for the 5-second undo window. */}
              <motion.span
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: 5, ease: "linear" }}
                className="absolute bottom-0 start-0 h-0.5 w-full origin-left bg-indigo-400 rtl:origin-right"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Portal>
  );
}
