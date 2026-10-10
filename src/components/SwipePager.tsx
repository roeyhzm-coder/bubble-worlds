import { animate, motion, useMotionValue } from "framer-motion";
import { Check, Pencil } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useApp } from "../state/AppProvider";

interface SwipePagerProps {
  page: number;
  onPage: (page: number) => void;
  locked?: boolean;
  children: ReactNode[];
}

const AXIS_LOCK = 8;
const PAGE_DISTANCE = 40;
const PAGE_VELOCITY = 320;

export function SwipePager({
  page,
  onPage,
  locked = false,
  children,
}: SwipePagerProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(page);
  const lockedRef = useRef(locked);
  const widthRef = useRef(390);
  const [width, setWidth] = useState(390);
  const x = useMotionValue(0);
  const gesture = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    lastX: number;
    lastT: number;
    axis: "h" | "v" | null;
    active: boolean;
  } | null>(null);

  pageRef.current = page;
  lockedRef.current = locked;
  widthRef.current = width;

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth || 390);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    void animate(x, -page * width, { type: "spring", stiffness: 380, damping: 38 });
  }, [page, width, x]);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;

    const maxPage = () => Math.max(0, children.length - 1);

    const settle = (fromDx: number) => {
      const w = widthRef.current;
      const current = pageRef.current;
      let pageNext = current;
      if (fromDx <= -PAGE_DISTANCE) pageNext = Math.min(maxPage(), current + 1);
      if (fromDx >= PAGE_DISTANCE) pageNext = Math.max(0, current - 1);
      onPage(pageNext);
      void animate(x, -pageNext * w, { type: "spring", stiffness: 380, damping: 38 });
    };

    const skipTarget = (target: EventTarget | null) => {
      const node = target as HTMLElement | null;
      if (!node) return false;
      if (node.closest("[data-no-pager-swipe]")) return true;
      if (node.closest("input, textarea, select, [contenteditable='true']")) return true;
      return false;
    };

    const onDown = (event: PointerEvent) => {
      if (lockedRef.current || event.button !== 0) return;
      if (skipTarget(event.target)) return;
      gesture.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastT: event.timeStamp,
        axis: null,
        active: true,
      };
    };

    const onMove = (event: PointerEvent) => {
      const g = gesture.current;
      if (!g?.active || g.pointerId !== event.pointerId) return;
      if (lockedRef.current) return;
      const dx = event.clientX - g.startX;
      const dy = event.clientY - g.startY;
      if (!g.axis) {
        if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return;
        g.axis = Math.abs(dx) >= Math.abs(dy) * 0.85 ? "h" : "v";
      }
      if (g.axis !== "h") return;
      event.preventDefault();
      if (el.hasPointerCapture?.(event.pointerId) !== true) {
        try {
          el.setPointerCapture(event.pointerId);
        } catch {
          /* ignore */
        }
      }
      const w = widthRef.current;
      const raw = -pageRef.current * w + dx;
      const min = -w * maxPage();
      x.set(Math.min(28, Math.max(min - 28, raw)));
      g.lastX = event.clientX;
      g.lastT = event.timeStamp;
    };

    const onUp = (event: PointerEvent) => {
      const g = gesture.current;
      if (!g?.active || g.pointerId !== event.pointerId) return;
      g.active = false;
      if (g.axis !== "h") {
        void animate(x, -pageRef.current * widthRef.current, {
          type: "spring",
          stiffness: 380,
          damping: 38,
        });
        gesture.current = null;
        return;
      }
      const dx = event.clientX - g.startX;
      const dt = Math.max(1, event.timeStamp - g.lastT);
      const vx = ((event.clientX - g.lastX) / dt) * 1000;
      let fromDx = dx;
      if (vx <= -PAGE_VELOCITY) fromDx = Math.min(fromDx, -PAGE_DISTANCE);
      if (vx >= PAGE_VELOCITY) fromDx = Math.max(fromDx, PAGE_DISTANCE);
      settle(fromDx);
      gesture.current = null;
    };

    el.addEventListener("pointerdown", onDown, { capture: true, passive: true });
    window.addEventListener("pointermove", onMove, { capture: true, passive: false });
    window.addEventListener("pointerup", onUp, { capture: true, passive: true });
    window.addEventListener("pointercancel", onUp, { capture: true, passive: true });
    return () => {
      el.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
    };
  }, [children.length, onPage, x]);

  return (
    <div
      ref={frameRef}
      dir="ltr"
      className="relative min-h-0 flex-1 overflow-hidden overflow-x-hidden"
      style={{ touchAction: "pan-y" }}
    >
      <motion.div
        className="flex h-full"
        style={{ x, width: width * children.length }}
      >
        {children.map((child, index) => (
          <div
            key={index}
            dir="rtl"
            className="h-full min-w-0 shrink-0 overflow-hidden overflow-x-hidden"
            style={{ width }}
          >
            {child}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

export function PageSwitcher({
  page,
  onPage,
}: {
  page: number;
  onPage: (page: number) => void;
}) {
  const { snapshot, setPageLabels } = useApp();
  const [editing, setEditing] = useState(false);
  const labels = snapshot.pageLabels;
  const tabs = [
    { id: 0, emoji: "🌐", key: "map" as const, value: labels.map },
    { id: 1, emoji: "🎯", key: "hub" as const, value: labels.hub },
    { id: 2, emoji: "⚙️", key: "studio" as const, value: labels.studio },
  ];

  return (
    <div className="mx-auto mt-1.5 flex w-full max-w-lg items-center gap-1.5">
      <div
        dir="ltr"
        className="flex h-11 min-w-0 flex-1 rounded-2xl bg-white p-1 shadow-soft"
      >
        {tabs.map((tab) =>
          editing ? (
            <input
              key={tab.id}
              value={tab.value}
              onChange={(e) => setPageLabels({ [tab.key]: e.target.value })}
              className="h-9 min-w-0 flex-1 rounded-xl bg-slate-50 px-1 text-center text-[11px] font-extrabold text-slate-800 outline-none"
              aria-label={`שם לשונית ${tab.emoji}`}
            />
          ) : (
            <button
              key={tab.id}
              type="button"
              onClick={() => onPage(tab.id)}
              className={`h-9 min-w-0 flex-1 truncate rounded-xl px-1 text-[11px] font-extrabold transition ${
                page === tab.id ? "bg-slate-900 text-white" : "text-slate-500"
              }`}
            >
              {tab.emoji} {tab.value}
            </button>
          ),
        )}
      </div>
      <button
        type="button"
        onClick={() => setEditing((v) => !v)}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-slate-500 shadow-soft"
        aria-label={editing ? "סיום עריכת שמות" : "עריכת שמות הלשוניות"}
      >
        {editing ? <Check size={16} /> : <Pencil size={15} />}
      </button>
    </div>
  );
}
