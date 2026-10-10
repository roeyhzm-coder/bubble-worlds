import { Check, Pencil } from "lucide-react";
import { useRef, useState, type ReactNode, type TouchEvent } from "react";
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
  const last = Math.max(0, children.length - 1);
  const activeTab = Math.max(0, Math.min(last, page));
  const start = useRef<{ x: number; y: number } | null>(null);
  const count = Math.max(children.length, 1);

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (locked) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    start.current = { x: touch.clientX, y: touch.clientY };
  };

  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const origin = start.current;
    start.current = null;
    if (!origin || locked) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const deltaX = origin.x - touch.clientX;
    const deltaY = origin.y - touch.clientY;
    if (Math.abs(deltaY) > Math.abs(deltaX)) return;
    if (Math.abs(deltaX) <= 45) return;
    if (deltaX > 45 && activeTab < last) onPage(activeTab + 1);
    if (deltaX < -45 && activeTab > 0) onPage(activeTab - 1);
  };

  return (
    <div
      dir="ltr"
      className="relative min-h-0 min-w-0 flex-1 overflow-hidden"
      style={{ direction: "ltr" }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={() => {
        start.current = null;
      }}
    >
      <div
        className="flex h-full w-[400%]"
        style={{
          transform: `translateX(-${(activeTab * 100) / count}%)`,
          transition: "transform 280ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {children.map((child, index) => (
          <div
            key={index}
            dir="rtl"
            className="h-full w-1/4 min-w-[100vw] shrink-0 overflow-hidden"
          >
            {child}
          </div>
        ))}
      </div>
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
    { id: 2, emoji: "✅", key: "daily" as const, value: labels.daily },
    { id: 3, emoji: "⚙️", key: "studio" as const, value: labels.studio },
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
              className="h-9 min-w-0 flex-1 rounded-xl bg-slate-50 px-0.5 text-center text-[10px] font-extrabold text-slate-800 outline-none"
              aria-label={`שם לשונית ${tab.emoji}`}
            />
          ) : (
            <button
              key={tab.id}
              type="button"
              onClick={() => onPage(tab.id)}
              className={`h-9 min-w-0 flex-1 truncate rounded-xl px-0.5 text-[10px] font-extrabold transition ${
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
