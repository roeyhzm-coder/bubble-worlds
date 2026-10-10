import { Check, Pencil } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode, type UIEvent } from "react";
import { useApp } from "../state/AppProvider";

interface SwipePagerProps {
  page: number;
  onPage: (page: number) => void;
  locked?: boolean;
  children: ReactNode[];
}

const PAGE_THRESHOLD = 36;

export function SwipePager({
  page,
  onPage,
  locked = false,
  children,
}: SwipePagerProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(page);
  const programmatic = useRef(false);
  const frame = useRef(0);
  const gesture = useRef<{
    startX: number;
    startPage: number;
    startLeft: number;
    pointerId: number;
  } | null>(null);
  const maxPage = Math.max(0, children.length - 1);
  pageRef.current = page;

  const clampPage = (index: number) => Math.max(0, Math.min(maxPage, index));

  const neighborPage = (from: number, direction: number) =>
    clampPage(from + (direction > 0 ? 1 : direction < 0 ? -1 : 0));

  const scrollToPage = (index: number, smooth: boolean) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const width = scroller.clientWidth;
    if (width <= 0) return;
    const next = clampPage(index);
    programmatic.current = true;
    scroller.scrollTo({
      left: next * width,
      behavior: smooth ? "smooth" : "auto",
    });
    window.setTimeout(() => {
      programmatic.current = false;
    }, smooth ? 380 : 60);
  };

  const commitNeighbor = (from: number, direction: number) => {
    const next = neighborPage(from, direction);
    if (next !== pageRef.current) onPage(next);
    scrollToPage(next, true);
  };

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const width = scroller.clientWidth || 1;
    if (Math.abs(scroller.scrollLeft - page * width) < 12) return;
    scrollToPage(page, true);
  }, [page]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const align = () => scrollToPage(pageRef.current, false);
    const observer = new ResizeObserver(align);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const skip = (target: EventTarget | null) => {
      const node = target as HTMLElement | null;
      return Boolean(node?.closest("input, textarea, select, [contenteditable='true']"));
    };

    const onDown = (event: PointerEvent) => {
      if (locked || event.button !== 0 || skip(event.target)) return;
      gesture.current = {
        startX: event.clientX,
        startPage: pageRef.current,
        startLeft: scroller.scrollLeft,
        pointerId: event.pointerId,
      };
    };

    const onUp = (event: PointerEvent) => {
      const g = gesture.current;
      if (!g || g.pointerId !== event.pointerId) return;
      gesture.current = null;
      const width = scroller.clientWidth || 1;
      const dx = event.clientX - g.startX;
      const dScroll = scroller.scrollLeft - g.startLeft;
      const moved = Math.abs(dx) >= PAGE_THRESHOLD || Math.abs(dScroll) >= width * 0.12;
      if (!moved) {
        scrollToPage(g.startPage, true);
        if (pageRef.current !== g.startPage) onPage(g.startPage);
        return;
      }
      const direction = dScroll !== 0 ? Math.sign(dScroll) : Math.sign(-dx);
      commitNeighbor(g.startPage, direction);
    };

    scroller.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("pointercancel", onUp, { passive: true });
    return () => {
      scroller.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [locked, maxPage, onPage]);

  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    if (programmatic.current || locked) return;
    const scroller = event.currentTarget;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const width = scroller.clientWidth || 1;
      const raw = Math.round(scroller.scrollLeft / width);
      const origin = gesture.current?.startPage ?? pageRef.current;
      if (Math.abs(raw - origin) > 1) {
        commitNeighbor(origin, raw - origin);
        return;
      }
      const next = clampPage(raw);
      if (next !== pageRef.current) onPage(next);
    });
  };

  return (
    <div
      ref={scrollerRef}
      dir="ltr"
      onScroll={onScroll}
      className="pager-scroller flex h-full min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden no-scrollbar"
      style={{ direction: "ltr" }}
    >
      {children.map((child, index) => (
        <div
          key={index}
          data-pager-panel={index}
          dir="rtl"
          className="pager-panel h-full w-full min-w-full shrink-0 snap-start snap-always overflow-hidden"
        >
          {child}
        </div>
      ))}
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
