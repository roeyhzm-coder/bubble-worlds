import { Check, Pencil } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode, type UIEvent } from "react";
import { useApp } from "../state/AppProvider";

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
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(page);
  const programmatic = useRef(false);
  const frame = useRef(0);
  pageRef.current = page;

  const scrollToPage = (index: number, smooth: boolean) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const width = scroller.clientWidth;
    if (width <= 0) return;
    programmatic.current = true;
    scroller.scrollTo({
      left: index * width,
      behavior: smooth ? "smooth" : "auto",
    });
    window.setTimeout(() => {
      programmatic.current = false;
    }, smooth ? 420 : 80);
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
    const panels = [...scroller.querySelectorAll<HTMLElement>("[data-pager-panel]")];
    if (panels.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (programmatic.current) return;
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const index = Number((visible?.target as HTMLElement | undefined)?.dataset.pagerPanel);
        if (!Number.isFinite(index) || index === pageRef.current) return;
        onPage(index);
      },
      { root: scroller, threshold: 0.55 },
    );
    for (const panel of panels) observer.observe(panel);
    return () => observer.disconnect();
  }, [children.length, onPage]);

  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    if (programmatic.current || locked) return;
    const scroller = event.currentTarget;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const width = scroller.clientWidth || 1;
      const next = Math.max(
        0,
        Math.min(children.length - 1, Math.round(scroller.scrollLeft / width)),
      );
      if (next !== pageRef.current) onPage(next);
    });
  };

  return (
    <div
      ref={scrollerRef}
      dir="ltr"
      onScroll={onScroll}
      className={`pager-scroller flex h-full min-h-0 min-w-0 flex-1 no-scrollbar ${
        locked ? "overflow-hidden" : "overflow-x-auto overflow-y-hidden"
      }`}
      style={{ direction: "ltr" }}
    >
      {children.map((child, index) => (
        <div
          key={index}
          data-pager-panel={index}
          dir="rtl"
          className="h-full w-full min-w-full shrink-0 snap-start overflow-hidden"
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
