import { animate, motion, useMotionValue } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

interface SwipePagerProps {
  page: number;
  onPage: (page: number) => void;
  locked?: boolean;
  children: ReactNode[];
}

const AXIS_LOCK = 10;
const PAGE_DISTANCE = 56;
const PAGE_VELOCITY = 420;

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
    void animate(x, -page * width, { type: "spring", stiffness: 340, damping: 36 });
  }, [page, width, x]);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;

    const settle = (fromDx: number) => {
      const w = widthRef.current;
      const current = pageRef.current;
      const max = children.length - 1;
      let pageNext = current;
      if (fromDx <= -PAGE_DISTANCE) pageNext = Math.min(max, current + 1);
      if (fromDx >= PAGE_DISTANCE) pageNext = Math.max(0, current - 1);
      onPage(pageNext);
      void animate(x, -pageNext * w, { type: "spring", stiffness: 340, damping: 36 });
    };

    const onDown = (event: PointerEvent) => {
      if (lockedRef.current || event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-no-pager-swipe]")) return;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
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
      if (!g?.active || g.pointerId !== event.pointerId || lockedRef.current) return;
      const dx = event.clientX - g.startX;
      const dy = event.clientY - g.startY;
      if (!g.axis) {
        if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return;
        g.axis = Math.abs(dx) >= Math.abs(dy) ? "h" : "v";
      }
      if (g.axis !== "h") return;
      if (el.hasPointerCapture?.(event.pointerId) !== true) {
        try {
          el.setPointerCapture(event.pointerId);
        } catch {
          /* ignore */
        }
      }
      event.preventDefault();
      const w = widthRef.current;
      const raw = -pageRef.current * w + dx;
      const min = -w * (children.length - 1);
      x.set(Math.min(24, Math.max(min - 24, raw)));
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
          stiffness: 340,
          damping: 36,
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

    el.addEventListener("pointerdown", onDown, { passive: true });
    el.addEventListener("pointermove", onMove, { passive: false });
    el.addEventListener("pointerup", onUp, { passive: true });
    el.addEventListener("pointercancel", onUp, { passive: true });
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, [children.length, onPage, x]);

  return (
    <div
      ref={frameRef}
      dir="ltr"
      className="relative min-h-0 flex-1 overflow-hidden touch-pan-y"
    >
      <motion.div
        className="flex h-full"
        style={{ x, width: width * children.length }}
      >
        {children.map((child, index) => (
          <div
            key={index}
            dir="rtl"
            className="h-full shrink-0 overflow-hidden"
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
  const items = ["מפת עולמות", "מוקדי פוקוס"];
  return (
    <div className="mx-auto mt-1.5 flex h-10 w-full max-w-sm rounded-full bg-white p-1 shadow-soft">
      {items.map((label, index) => {
        const active = page === index;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onPage(index)}
            className={`h-8 flex-1 rounded-full text-[12px] font-bold transition ${
              active ? "bg-slate-900 text-white" : "text-slate-500"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
