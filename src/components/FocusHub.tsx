import { Palette } from "lucide-react";
import { useMemo, useState } from "react";
import { statusLabel, trackingProgress } from "../lib/tracking";
import { useApp } from "../state/AppProvider";
import type { Bubble, BubbleStatus } from "../types";
import { ColorSettingsModal } from "./ColorSettingsModal";
import { ProgressRing } from "./ProgressRing";

const ROLE_ORDER: BubbleStatus[] = [
  "active_tracking",
  "focus",
  "deep_thought",
  "default",
];

export function FocusHub() {
  const { snapshot, childrenOf, openEditor, setPage, setDrill } = useApp();
  const [colorsOpen, setColorsOpen] = useState(false);

  const leaves = useMemo(
    () => snapshot.bubbles.filter((b) => childrenOf(b.id).length === 0),
    [childrenOf, snapshot.bubbles],
  );

  const groups = useMemo(() => {
    const byStatus = new Map<BubbleStatus, Bubble[]>();
    for (const status of ROLE_ORDER) byStatus.set(status, []);
    const extra = new Map<string, Bubble[]>();
    for (const bubble of leaves) {
      if (bubble.status !== "default" || bubble.is_tracking) {
        const key = bubble.is_tracking ? "active_tracking" : bubble.status;
        byStatus.get(key)?.push(bubble);
      } else {
        const list = extra.get(bubble.color) ?? [];
        list.push(bubble);
        extra.set(bubble.color, list);
      }
    }
    return { byStatus, extra };
  }, [leaves]);

  return (
    <section className="flex h-full flex-col">
      <div className="flex h-12 items-center justify-between px-3">
        <div>
          <div className="text-[15px] font-extrabold text-slate-800">
            מוקדי פוקוס
          </div>
          <div className="text-[11px] text-slate-400">
            כל בועות הקצה הפעילות
          </div>
        </div>
        <button
          type="button"
          onClick={() => setColorsOpen(true)}
          className="inline-flex h-9 items-center gap-1 rounded-xl bg-white px-2.5 text-sm font-semibold text-slate-600 shadow-soft"
        >
          <Palette size={15} />
          צבעים
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-y-contain px-3 pb-24 no-scrollbar [touch-action:pan-y]">
        {ROLE_ORDER.filter((s) => (groups.byStatus.get(s) ?? []).length > 0).map(
          (status) => (
            <GroupBlock
              key={status}
              title={statusLabel(status)}
              color={snapshot.colorRoles[status]}
              items={groups.byStatus.get(status) ?? []}
              onOpen={(b) => {
                openEditor({ type: "bubble", id: b.id });
                setPage(1);
              }}
              onEnter={(b) => {
                setDrill({ kind: "bubble", id: b.id });
                setPage(0);
              }}
            />
          ),
        )}

        {[...groups.extra.entries()].map(([color, items]) => (
          <GroupBlock
            key={color}
            title="קבוצת צבע"
            color={color}
            items={items}
            onOpen={(b) => openEditor({ type: "bubble", id: b.id })}
            onEnter={(b) => {
              setDrill({ kind: "bubble", id: b.id });
              setPage(0);
            }}
          />
        ))}

        {leaves.filter((b) => b.status !== "default" || b.is_tracking).length ===
          0 &&
          groups.extra.size === 0 && (
            <div className="grid h-40 place-items-center text-sm text-slate-400">
              אין עדיין מוקדים פעילים. הגדירו סטטוס או מעקב בבועה.
            </div>
          )}
      </div>

      <ColorSettingsModal open={colorsOpen} onClose={() => setColorsOpen(false)} />
    </section>
  );
}

function GroupBlock({
  title,
  color,
  items,
  onOpen,
  onEnter,
}: {
  title: string;
  color: string;
  items: Bubble[];
  onOpen: (b: Bubble) => void;
  onEnter: (b: Bubble) => void;
}) {
  return (
    <div className="rounded-2xl bg-white/80 p-2.5 shadow-soft">
      <div className="mb-2 flex h-8 items-center gap-2 px-1">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: color }}
        />
        <span className="text-xs font-bold text-slate-600">{title}</span>
        <span className="text-[11px] text-slate-400">{items.length}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => {
          const progress = trackingProgress(item);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpen(item)}
              onDoubleClick={() => onEnter(item)}
              className="relative flex h-[104px] flex-col items-center justify-center rounded-2xl px-2"
              style={{
                background: `${color}14`,
                border: `1px solid ${color}44`,
              }}
            >
              {item.is_tracking && (
                <div className="relative mb-1 grid h-10 w-10 place-items-center">
                  <ProgressRing ratio={progress.ratio} size={40} color={color} />
                  <span className="text-[9px] font-bold text-slate-600">
                    {progress.done}
                  </span>
                </div>
              )}
              <div className="line-clamp-2 text-center text-[12px] font-bold leading-tight text-slate-800">
                {item.title}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
