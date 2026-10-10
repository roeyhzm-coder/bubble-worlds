import { motion, useMotionValue } from "framer-motion";
import { Expand } from "lucide-react";
import { useRef } from "react";
import { trackingProgress } from "../lib/tracking";
import type { Bubble, Category } from "../types";
import { ProgressRing } from "./ProgressRing";

interface BubbleNodeProps {
  item: Category | Bubble;
  type: "category" | "bubble";
  childCount: number;
  onOpen: () => void;
  onEdit: () => void;
  onMove: (x: number, y: number) => void;
  onDragChange: (dragging: boolean) => void;
}

function isBubble(_item: Category | Bubble, type: "category" | "bubble"): _item is Bubble {
  return type === "bubble";
}

const DRAG_THRESHOLD = 14;

export function BubbleNode({
  item,
  type,
  childCount,
  onOpen,
  onEdit,
  onMove,
  onDragChange,
}: BubbleNodeProps) {
  const start = useRef({ x: 0, y: 0 });
  const lastTap = useRef(0);
  const tapTimer = useRef<number | null>(null);
  const dragged = useRef(false);
  const dx = useMotionValue(0);
  const dy = useMotionValue(0);

  const title = type === "category" ? (item as Category).name : (item as Bubble).title;
  const color = item.color;
  const sizeMul = isBubble(item, type) ? item.size_multiplier : 1.15;
  const diameter = Math.min(168, 78 + childCount * 7) * sizeMul;
  const tracking = isBubble(item, type) && item.is_tracking;
  const progress = isBubble(item, type) ? trackingProgress(item) : null;

  const clearTap = () => {
    if (tapTimer.current) {
      window.clearTimeout(tapTimer.current);
      tapTimer.current = null;
    }
  };

  return (
    <motion.div
      data-no-pager-swipe
      drag
      dragMomentum={false}
      dragElastic={0.05}
      dragPropagation={false}
      onPointerDownCapture={() => {
        dragged.current = false;
      }}
      onDragStart={(_, info) => {
        start.current = { x: info.point.x, y: info.point.y };
      }}
      onDrag={(_, info) => {
        const dist = Math.hypot(
          info.point.x - start.current.x,
          info.point.y - start.current.y,
        );
        if (dist > DRAG_THRESHOLD && !dragged.current) {
          dragged.current = true;
          clearTap();
          onDragChange(true);
        }
      }}
      onDragEnd={(event, info) => {
        const wasDrag = dragged.current;
        onDragChange(false);
        if (wasDrag) {
          const parent = (event.target as HTMLElement).closest("[data-canvas]");
          if (parent) {
            const rect = parent.getBoundingClientRect();
            const nx = ((info.point.x - rect.left) / rect.width) * 100;
            const ny = ((info.point.y - rect.top) / rect.height) * 100;
            onMove(nx, ny);
          }
        }
        dx.set(0);
        dy.set(0);
      }}
      onTap={() => {
        if (dragged.current) return;
        const now = Date.now();
        if (now - lastTap.current < 280) {
          clearTap();
          lastTap.current = 0;
          onOpen();
          return;
        }
        lastTap.current = now;
        tapTimer.current = window.setTimeout(() => {
          if (!dragged.current) onEdit();
        }, 280);
      }}
      style={{
        left: `${item.position_x}%`,
        top: `${item.position_y}%`,
        width: diameter,
        height: diameter,
        x: dx,
        y: dy,
      }}
      className="absolute -translate-x-1/2 -translate-y-1/2 touch-none select-none"
      whileTap={{ scale: 0.97 }}
    >
      <div
        className="relative grid h-full w-full place-items-center rounded-full shadow-bubble"
        style={{
          background: `radial-gradient(circle at 30% 25%, #ffffff 0%, ${color}22 55%, ${color}33 100%)`,
          border: `1.5px solid ${color}66`,
        }}
      >
        {tracking && progress && (
          <ProgressRing
            ratio={progress.ratio}
            size={diameter + 12}
            color={color}
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          />
        )}
        <div className="px-3 text-center">
          <div className="line-clamp-2 text-[13px] font-bold leading-tight text-slate-800">
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
          aria-label="כניסה לעולם"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            clearTap();
            onOpen();
          }}
          className="absolute -bottom-1 -start-1 grid h-8 w-8 place-items-center rounded-full bg-white text-slate-500 shadow-soft"
        >
          <Expand size={14} />
        </button>
      </div>
    </motion.div>
  );
}
