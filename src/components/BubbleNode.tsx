import { motion, useMotionValue } from "framer-motion";
import { Pencil } from "lucide-react";
import { useRef, type RefObject } from "react";
import type { Bubble, Category } from "../types";

interface BubbleNodeProps {
  item: Category | Bubble;
  type: "category" | "bubble";
  boundsRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLDivElement | null>;
  onOpen: () => void;
  onEdit: () => void;
  onMove: (x: number, y: number) => void;
  onDragChange: (dragging: boolean) => void;
}

function isBubble(_item: Category | Bubble, type: "category" | "bubble"): _item is Bubble {
  return type === "bubble";
}

const BASE = 104;
const MARGIN = 16;
const DRAG_THRESHOLD = 12;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function BubbleNode({
  item,
  type,
  boundsRef,
  canvasRef,
  onOpen,
  onEdit,
  onMove,
  onDragChange,
}: BubbleNodeProps) {
  const offsetX = useMotionValue(0);
  const offsetY = useMotionValue(0);
  const start = useRef({ x: 0, y: 0 });
  const dragged = useRef(false);
  const blockTap = useRef(false);
  const title = type === "category" ? (item as Category).name : (item as Bubble).title;
  const color = item.color;
  const sizeMul = isBubble(item, type) ? item.size_multiplier || 1 : 1;
  const diameter = BASE * sizeMul;

  return (
    <motion.div
      data-no-pager-swipe
      drag
      dragMomentum={false}
      dragElastic={0}
      dragPropagation={false}
      dragConstraints={boundsRef}
      onPointerDownCapture={() => {
        dragged.current = false;
        blockTap.current = false;
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
          onDragChange(true);
        }
      }}
      onDragEnd={() => {
        const wasDrag = dragged.current;
        onDragChange(false);
        const canvas = canvasRef.current;
        const dx = offsetX.get();
        const dy = offsetY.get();
        if (!wasDrag || !canvas) {
          offsetX.set(0);
          offsetY.set(0);
          return;
        }
        const { width, height } = canvas.getBoundingClientRect();
        if (width < 32 || height < 32) {
          offsetX.set(0);
          offsetY.set(0);
          return;
        }
        const r = diameter / 2;
        const min = ((MARGIN + r) / width) * 100;
        const maxX = ((width - MARGIN - r) / width) * 100;
        const minY = ((MARGIN + r) / height) * 100;
        const maxY = ((height - MARGIN - r) / height) * 100;
        const nx = clamp(item.position_x + (dx / width) * 100, min, maxX);
        const ny = clamp(item.position_y + (dy / height) * 100, minY, maxY);
        onMove(nx, ny);
        offsetX.set(0);
        offsetY.set(0);
      }}
      onTap={() => {
        if (dragged.current || blockTap.current) return;
        onOpen();
      }}
      style={{
        left: `${item.position_x}%`,
        top: `${item.position_y}%`,
        width: diameter,
        height: diameter,
        marginLeft: -diameter / 2,
        marginTop: -diameter / 2,
        x: offsetX,
        y: offsetY,
      }}
      className="absolute touch-none select-none"
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
        <div className="relative z-[1] px-3 text-center">
          <div className="line-clamp-2 text-[13px] font-extrabold leading-tight tracking-tight text-slate-800">
            {title}
          </div>
        </div>
        <button
          type="button"
          aria-label="עריכה"
          onPointerDown={(e) => {
            e.stopPropagation();
            blockTap.current = true;
          }}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            blockTap.current = true;
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
