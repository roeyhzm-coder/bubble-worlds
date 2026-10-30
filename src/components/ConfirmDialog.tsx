import { AnimatePresence, motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { useDialogFocus, useEscape } from "../lib/useEscape";
import { Portal } from "./Portal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  /** "danger" (rose, default) for deletes; "warning" (amber) for risky but recoverable actions. */
  tone?: "danger" | "warning";
  /** Shows a spinner and disables both buttons while the action runs. */
  busy?: boolean;
  /** Extra content between the body and the buttons. */
  children?: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "מחיקה",
  tone = "danger",
  busy = false,
  children,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  const cancel = () => {
    if (!busy) onCancel();
  };
  useEscape(open, cancel);
  useDialogFocus(open, panel);
  return (
    <Portal>
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] grid place-items-center bg-slate-900/30 px-6 py-[max(1rem,env(safe-area-inset-top))]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={cancel}
        >
          <motion.div
            ref={panel}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            tabIndex={-1}
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
            className="max-h-[min(80dvh,32rem)] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-4 shadow-soft outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 id="confirm-dialog-title" className="text-base font-bold text-slate-800">{title}</h3>
              <button
                type="button"
                onClick={cancel}
                disabled={busy}
                className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500"
                aria-label="סגירה"
                title="סגירה"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-500">{body}</p>
            {children}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={cancel}
                disabled={busy}
                data-autofocus
                className="h-11 flex-1 rounded-xl bg-slate-100 text-sm font-semibold text-slate-600 disabled:opacity-50"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={busy}
                aria-busy={busy}
                className={`flex h-11 flex-[1.6] items-center justify-center gap-1.5 rounded-xl px-2 text-sm text-white disabled:opacity-70 ${
                  tone === "warning" ? "bg-amber-500 font-extrabold shadow-sm shadow-amber-500/30" : "bg-rose-500 font-semibold"
                }`}
              >
                {busy && <Loader2 size={15} className="animate-spin" />}
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </Portal>
  );
}
