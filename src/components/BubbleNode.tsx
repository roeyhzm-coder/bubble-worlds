import { motion, useMotionValue } from "framer-motion";
import { Pencil } from "lucide-react";
import { useCallback, useLayoutEffect, useRef, type RefObject } from "react";
import { trackingProgress } from "../lib/tracking";
import type { Bubble, Category } from "../types";
import { ProgressRing } from "./ProgressRing";

interface BubbleNodeProps {
  item: Category | Bubble;
  type: "category" | "bubble";
  childCount: number;
  canvasRef: RefObject<HTMLDivElement | null>;
  boundsRef: RefObject<HTMLDivElement | null>;
  onOpen: () => void;
  onEdit: () => void;
  onMove: (x: number, y: number) => void;
  onDragChange: (dragging: boolean) => void;
}

function isBubble(_item: Category | Bubble, type: "category" | "bubble"): _item is Bubble {
  return type === "bubble";
}

const MARGIN = 16;
const DRAG_THRESHOLD = 12;
const LONG_PRESS_MS = 480;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function BubbleNode({
  item,
  type,
  childCount,
  canvasRef,
  boundsRef,
  onOpen,
  onEdit,
  onMove,
  onDragChange,
}: BubbleNodeProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const start = useRef({ x: 0, y: 0 });
  const dragged = useRef(false);
  const longTimer = useRef<number | null>(null);
  const longFired = useRef(false);
  const title = type === "category" ? (item as Category).name : (item as Bubble).title;
  const color = item.color;
  const sizeMul = isBubble(item, type) ? item.size_multiplier : 1.15;
  const diameter = Math.min(168, 82 + childCount * 7) * sizeMul;
  const tracking = isBubble(item, type) && item.is_tracking;
  const progress = isBubble(item, type) ? trackingProgress(item) : null;

  const place = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width, height } = canvas.getBoundingClientRect();
    const r = diameter / 2;
    const cx = clamp((item.position_x / 100) * width, MARGIN + r, width - MARGIN - r);
    const cy = clamp((item.position_y / 100) * height, MARGIN + r, height - MARGIN - r);
    x.set(cx - r);
    y.set(cy - r);
  }, [canvasRef, diameter, item.position_x, item.position_y, x, y]);

  useLayoutEffect(() => {
    place();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(place);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [canvasRef, place]);

  const clearLong = () => {
    if (longTimer.current) {
      window.clearTimeout(longTimer.current);
      longTimer.current = null;
    }
  };

  return (
    <motion.div
      data-no-pager-swipe
      drag
      dragMomentum={false}
      dragElastic={0}
      dragPropagation={false}
      dragConstraints={boundsRef}
      onPointerDownCapture={(event) => {
        dragged.current = false;
        longFired.current = false;
        start.current = { x: event.clientX, y: event.clientY };
        clearLong();
        longTimer.current = window.setTimeout(() => {
          longFired.current = true;
          onEdit();
        }, LONG_PRESS_MS);
      }}
      onPointerUpCapture={clearLong}
      onPointerCancelCapture={clearLong}
      onDragStart={(_, info) => {
        start.current = { x: info.point.x, y: info.point.y };
      }}
      onDrag={(_, info) => {
        const dist = Math.hypot(
          info.point.x - start.current.x,
          info.point.y - start.current.y,
        );
        if (dist > DRAG_THRESHOLD) {
          clearLong();
          if (!dragged.current) {
            dragged.current = true;
            onDragChange(true);
          }
        }
      }}
      onDragEnd={() => {
        const wasDrag = dragged.current;
        onDragChange(false);
        clearLong();
        const canvas = canvasRef.current;
        if (!canvas || !wasDrag) return;
        const { width, height } = canvas.getBoundingClientRect();
        const maxLeft = Math.max(MARGIN, width - diameter - MARGIN);
        const maxTop = Math.max(MARGIN, height - diameter - MARGIN);
        const left = clamp(x.get(), MARGIN, maxLeft);
        const top = clamp(y.get(), MARGIN, maxTop);
        x.set(left);
        y.set(top);
        const cx = ((left + diameter / 2) / width) * 100;
        const cy = ((top + diameter / 2) / height) * 100;
        onMove(cx, cy);
      }}
      onTap={() => {
        if (dragged.current || longFired.current) return;
        onOpen();
      }}
      style={{ x, y, width: diameter, height: diameter }}
      className="absolute left-0 top-0 touch-none select-none"
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
    >
      <div
        className="relative grid h-full w-full place-items-center overflow-hidden rounded-full"
        style={{
          background: `radial-gradient(circle at 28% 22%, rgba(255,255,255,0.96) 0%, ${color}2e 48%, ${color}59 100%)`,
          border: "1px solid rgba(255,255,255,0.62)",
          boxShadow: `0 14px 28px -12px ${color}73, 0 6px 14px -8px rgba(15,23,42,0.22), inset 0 1px 0 rgba(255,255,255,0.78)`,
          backdropFilter: "blur(10px)",
        }}
      >
        {tracking && progress && (
          <ProgressRing
            ratio={progress.ratio}
            size={diameter + 8}
            color={color}
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          />
        )}
        <div className="relative z-[1] px-3 text-center">
          <div className="line-clamp-2 text-[13px] font-extrabold leading-tight tracking-tight text-slate-800">
            {title}
          </div>
          {tracking && progress && (
            <div className="mt-0.5 text-[10px] font-semibold text-slate-500">
              {progress.done}/{progress.target}
            </div>
          )}
          {childCount > 0 && !tracking && (
            <div className="mt-0.5 text-[10px] font-medium text-slate-500">
              {childCount} פריטים
            </div>
          )}
        </div>
        <button
          type="button"
          aria-label="עריכה"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            clearLong();
            onEdit();
          }}
          className="absolute -bottom-0.5 -start-0.5 z-[2] grid h-8 w-8 place-items-center rounded-full bg-white/90 text-slate-500 shadow-soft backdrop-blur"
        >
          <Pencil size={13} />
        </button>
      </div>
    </motion.div>
  );
}
