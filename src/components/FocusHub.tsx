import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";
import { dueText } from "../lib/triangles";
import { trackingProgress } from "../lib/tracking";
import { useApp } from "../state/AppProvider";
import type { Bubble, TriangleType } from "../types";
import { TypeTools } from "./ItemTools";
import { ProgressRing } from "./ProgressRing";

export function FocusHub() {
  const { snapshot, setPage, setDrill } = useApp();
  const [openId, setOpenId] = useState<string | null>(null);

  const groups = useMemo(() => {
    return snapshot.triangleTypes
      .slice()
      .sort((a, b) => a.order_index - b.order_index)
      .map((type) => ({
        type,
        items: snapshot.bubbles.filter((item) => item.triangle_id === type.id),
      }))
      .filter((group) => group.items.length > 0);
  }, [snapshot.bubbles, snapshot.triangleTypes]);

  return (
    <section className="flex h-full min-w-0 flex-col overflow-x-hidden">
      <div className="flex items-start justify-between gap-2 px-3 pb-1">
        <div>
          <div className="text-[15px] font-extrabold text-slate-800">
            {snapshot.pageLabels.hub}
          </div>
          <div className="text-[11px] text-slate-400">כל הפריטים לפי סוג משולש</div>
        </div>
        {openId && (
          <button
            type="button"
            onClick={() => setOpenId(null)}
            className="h-8 rounded-lg px-2 text-[11px] font-extrabold text-slate-500"
          >
            כיווץ הכל
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden overscroll-y-contain px-3 pb-24 no-scrollbar">
        {groups.map(({ type, items }) => (
          <section key={type.id} className="rounded-2xl bg-white/80 p-2.5 shadow-soft">
            <div className="mb-2 flex h-8 items-center gap-2 px-1">
              <span className="text-base leading-none" style={{ color: type.color }}>
                ▼
              </span>
              <span className="text-xs font-extrabold text-slate-700">{type.name}</span>
              <span className="text-[11px] text-slate-400">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map((item) => (
                <HubCard
                  key={item.id}
                  item={item}
                  type={type}
                  open={openId === item.id}
                  onToggle={() => setOpenId((current) => (current === item.id ? null : item.id))}
                  onSource={() => {
                    setDrill(
                      item.parent_bubble_id
                        ? { kind: "bubble", id: item.parent_bubble_id }
                        : { kind: "category", id: item.category_id },
                    );
                    setPage(0);
                  }}
                />
              ))}
            </div>
          </section>
        ))}

        {groups.length === 0 && (
          <div className="grid h-40 place-items-center text-sm text-slate-400">
            אין עדיין פריטים עם משולש. פריטים כלליים נשארים ברשימת המקור עד שמשייכים להם סוג.
          </div>
        )}
      </div>
    </section>
  );
}

function HubCard({
  item,
  type,
  open,
  onToggle,
  onSource,
}: {
  item: Bubble;
  type: TriangleType;
  open: boolean;
  onToggle: () => void;
  onSource: () => void;
}) {
  const progress = trackingProgress(item);
  return (
    <div className="rounded-2xl bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex min-h-12 w-full items-center gap-2 px-2 text-start"
      >
        {type.template === "tracking" && (
          <div className="relative grid h-10 w-10 shrink-0 place-items-center">
            <ProgressRing ratio={progress.ratio} size={40} color={type.color} className="absolute inset-0" />
            <span className="text-[9px] font-extrabold text-slate-600">{progress.done}</span>
          </div>
        )}
        {type.template === "action" && (
          <span
            className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border ${
              item.action_done ? "bg-emerald-500 text-white" : "border-slate-300"
            }`}
          >
            {item.action_done ? "✓" : ""}
          </span>
        )}
        {type.template === "thought" && (
          <span className="shrink-0 text-base" style={{ color: type.color }}>
            ▼
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-bold text-slate-800">{item.title || "ללא שם"}</div>
          {type.template === "action" && dueText(item) && (
            <div className="truncate text-[11px] font-bold text-emerald-600">{dueText(item)}</div>
          )}
        </div>
        {open ? (
          <ChevronUp size={16} className="shrink-0 text-slate-400" />
        ) : (
          <ChevronDown size={16} className="shrink-0 text-slate-400" />
        )}
      </button>
      {open && (
        <>
          <button
            type="button"
            onClick={onSource}
            className="px-3 pb-1 text-[11px] font-bold text-slate-400"
          >
            לעולם המקור
          </button>
          <TypeTools item={item} spacious={type.template === "thought"} />
        </>
      )}
    </div>
  );
}
