import { motion, useMotionValue } from "framer-motion";
import { Pencil } from "lucide-react";
import { useRef, type RefObject } from "react";
import type { Bubble, Category } from "../types";

interface BubbleNodeProps {
  item: Category | Bubble;
  type: "category" | "bubble";
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
  canvasRef,
  onOpen,
  onEdit,
  onMove,
  onDragChange,
}: BubbleNodeProps) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const offsetX = useMotionValue(0);
  const offsetY = useMotionValue(0);
  const start = useRef({ x: 0, y: 0 });
  const dragged = useRef(false);
  const blockTap = useRef(false);
  const title = type === "category" ? (item as Category).name : (item as Bubble).title;
  const color = item.color;
  const sizeMul = isBubble(item, type) ? item.size_multiplier || 1 : 1;
  const diameter = BASE * sizeMul;

  const resetOffset = () => {
    offsetX.set(0);
    offsetY.set(0);
  };

  return (
    <motion.div
      ref={nodeRef}
      data-bubble-node={item.id}
      drag
      dragMomentum={false}
      dragElastic={0}
      dragPropagation={false}
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
        const node = nodeRef.current;
        if (!wasDrag || !canvas || !node) {
          resetOffset();
          return;
        }
        const c = canvas.getBoundingClientRect();
        const b = node.getBoundingClientRect();
        if (c.width < 32 || c.height < 32) {
          resetOffset();
          return;
        }
        const r = diameter / 2;
        const minX = ((MARGIN + r) / c.width) * 100;
        const maxX = ((c.width - MARGIN - r) / c.width) * 100;
        const minY = ((MARGIN + r) / c.height) * 100;
        const maxY = ((c.height - MARGIN - r) / c.height) * 100;
        const nx = clamp(((b.left + b.width / 2 - c.left) / c.width) * 100, minX, maxX);
        const ny = clamp(((b.top + b.height / 2 - c.top) / c.height) * 100, minY, maxY);
        if (Number.isFinite(nx) && Number.isFinite(ny)) {
          onMove(nx, ny);
        }
        resetOffset();
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
      className="absolute select-none"
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
