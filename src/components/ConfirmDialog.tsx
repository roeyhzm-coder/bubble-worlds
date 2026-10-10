import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "מחיקה",
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] grid place-items-center bg-slate-900/30 px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
        >
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
            className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-soft"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-base font-bold text-slate-800">{title}</h3>
              <button
                type="button"
                onClick={onCancel}
                className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500"
                aria-label="סגירה"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-500">{body}</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="h-11 flex-1 rounded-xl bg-slate-100 text-sm font-semibold text-slate-600"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="h-11 flex-1 rounded-xl bg-rose-500 text-sm font-semibold text-white"
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
