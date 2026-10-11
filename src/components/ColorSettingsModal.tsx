import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { PALETTE } from "../lib/defaults";
import { statusLabel } from "../lib/tracking";
import { useApp } from "../state/AppProvider";
import type { BubbleStatus } from "../types";
import { Portal } from "./Portal";

const STATUSES: BubbleStatus[] = [
  "active_tracking",
  "focus",
  "deep_thought",
  "default",
];

interface ColorSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function ColorSettingsModal({ open, onClose }: ColorSettingsModalProps) {
  const { snapshot, applyStatusColor } = useApp();

  return (
    <Portal>
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] grid place-items-center bg-slate-900/25"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 700) onClose();
            }}
            className="w-full max-w-md rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-soft sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex h-10 items-center justify-between">
              <h2 className="text-base font-extrabold text-slate-800">
                צבעים גלובליים
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              שינוי צבע מעדכן מיידית את כל הבועות מאותו סוג.
            </p>
            <div className="space-y-3">
              {STATUSES.map((status) => (
                <div key={status}>
                  <div className="mb-1.5 text-xs font-bold text-slate-600">
                    {statusLabel(status)}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PALETTE.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => applyStatusColor(status, color)}
                        className="h-8 w-8 rounded-full border-2"
                        style={{
                          background: color,
                          borderColor:
                            snapshot.colorRoles[status] === color
                              ? "#0f172a"
                              : "transparent",
                        }}
                        aria-label={`צבע ${color}`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </Portal>
  );
}
