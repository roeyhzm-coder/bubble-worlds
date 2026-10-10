import { animate, motion, useMotionValue } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

interface SwipePagerProps {
  page: number;
  onPage: (page: number) => void;
  locked?: boolean;
  children: ReactNode[];
}

export function SwipePager({
  page,
  onPage,
  locked = false,
  children,
}: SwipePagerProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(390);
  const x = useMotionValue(0);

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
    void animate(x, -page * width, { type: "spring", stiffness: 320, damping: 34 });
  }, [page, width, x]);

  return (
    <div ref={frameRef} className="relative min-h-0 flex-1 overflow-hidden">
      <motion.div
        className="flex h-full"
        style={{ x, width: width * children.length }}
        drag={locked ? false : "x"}
        dragElastic={0.12}
        dragConstraints={{ left: -width * (children.length - 1), right: 0 }}
        onDragEnd={(_, info) => {
          const offset = info.offset.x;
          const velocity = info.velocity.x;
          let next = page;
          if (offset < -70 || velocity < -500) next = Math.min(children.length - 1, page + 1);
          if (offset > 70 || velocity > 500) next = Math.max(0, page - 1);
          onPage(next);
          void animate(x, -next * width, {
            type: "spring",
            stiffness: 320,
            damping: 34,
          });
        }}
      >
        {children.map((child, index) => (
          <div key={index} className="h-full shrink-0 overflow-hidden" style={{ width }}>
            {child}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

export function DotIndicator({
  page,
  count,
  onPage,
}: {
  page: number;
  count: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-1.5 py-1">
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          type="button"
          aria-label={`עמוד ${i + 1}`}
          onClick={() => onPage(i)}
          className={`h-1.5 rounded-full transition-all ${
            page === i ? "w-4 bg-slate-700" : "w-1.5 bg-slate-300"
          }`}
        />
      ))}
    </div>
  );
}
