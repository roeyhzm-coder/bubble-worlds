import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useDialogFocus, useEscape } from "../lib/useEscape";
import { Portal } from "./Portal";

interface ViewportBox {
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
 * The visible viewport while `active`. The Android keyboard shrinks visualViewport.height;
 * `keyboardOpen` compares it with the tallest height seen since opening / the last rotation.
 */
function useKeyboardViewport(active: boolean): ViewportBox {
  const [box, setBox] = useState<ViewportBox>(() => ({ ...readViewport(), keyboardOpen: false }));
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

/**
 * RTL portal dialog (z-80). The backdrop is sized to window.visualViewport and the panel is
 * top-anchored with its actions in the header, so the Android keyboard and the system
 * navigation bar never cover an input or a button.
 */
export function ViewportModal({
  open,
  onClose,
  titleId,
  title,
  headerActions,
  children,
  toolbar,
}: {
  open: boolean;
  onClose: () => void;
  titleId: string;
  title: ReactNode;
  /** Extra buttons in the sticky header, before the close button. */
  headerActions?: ReactNode;
  children: ReactNode;
  /** Optional non-scrolling action bar pinned under the header (always above the keyboard). */
  toolbar?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const viewport = useKeyboardViewport(open);
  useEscape(open, onClose);
  useDialogFocus(open, panel);

  return (
    <Portal>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-x-0 z-[80] flex items-start justify-center bg-slate-950/50 px-3 pt-[max(2.75rem,env(safe-area-inset-top))] backdrop-blur-[2px] sm:items-center sm:p-6"
            style={{ top: viewport.offsetTop, height: viewport.height }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          >
            <motion.div
              ref={panel}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
              dir="rtl"
              initial={{ y: -12, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -8, opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              className={`flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-slate-800 shadow-2xl outline-none ${
                viewport.keyboardOpen ? "max-h-[calc(100%-0.5rem)]" : "max-h-[calc(100%-3.5rem)]"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
                <h3 id={titleId} className="flex min-w-0 items-center gap-2 text-[15px] font-extrabold">
                  {title}
                </h3>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                  {headerActions}
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="סגירה"
                    className="grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
              {toolbar && <div className="shrink-0 border-b border-slate-100 px-3 py-2">{toolbar}</div>}
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">{children}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
