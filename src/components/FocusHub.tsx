import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { dueText, findTriangle } from "../lib/triangles";
import { trackingProgress } from "../lib/tracking";
import { useApp } from "../state/AppProvider";
import type { Bubble, TriangleType } from "../types";
import { TypeTools } from "./ItemTools";
import { ProgressRing } from "./ProgressRing";

export function FocusHub() {
  const { snapshot, setPage, setDrill } = useApp();
  const [openId, setOpenId] = useState<string | null>(null);
  const [notesId, setNotesId] = useState<string | null>(null);

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

  const notesItem = snapshot.bubbles.find((item) => item.id === notesId) ?? null;

  return (
    <section className="flex h-full flex-col">
      <div className="px-3 pb-1">
        <div className="text-[15px] font-extrabold text-slate-800">מוקדי פוקוס</div>
        <div className="text-[11px] text-slate-400">כל הפריטים לפי סוג משולש, מסונכרנים בזמן אמת</div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-y-contain px-3 pb-24 no-scrollbar [touch-action:pan-y]">
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
              {items.map((item) => {
                const open = openId === item.id;
                return (
                  <HubCard
                    key={item.id}
                    item={item}
                    type={type}
                    open={open}
                    onToggle={() => {
                      if (type.template === "thought") {
                        setNotesId(item.id);
                        return;
                      }
                      setOpenId(open ? null : item.id);
                    }}
                    onSource={() => {
                      setDrill(
                        item.parent_bubble_id
                          ? { kind: "bubble", id: item.parent_bubble_id }
                          : { kind: "category", id: item.category_id },
                      );
                      setPage(0);
                    }}
                  />
                );
              })}
            </div>
          </section>
        ))}

        {groups.length === 0 && (
          <div className="grid h-40 place-items-center text-sm text-slate-400">
            אין עדיין פריטים עם משולש. צרו פריט ברשימה או שייכו סוג בעמוד הניהול.
          </div>
        )}
      </div>

      {notesItem && (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-900/30" onClick={() => setNotesId(null)}>
          <div
            className="flex max-h-[88dvh] w-full flex-col rounded-t-3xl bg-white px-4 pb-6 pt-3 shadow-soft"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="text-sm font-extrabold text-slate-800">{notesItem.title}</div>
                <div className="text-[11px] font-bold text-slate-400">
                  {findTriangle(snapshot.triangleTypes, notesItem.triangle_id)?.name ?? "מחשבה"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNotesId(null)}
                className="grid h-10 w-10 place-items-center rounded-full bg-slate-100"
                aria-label="סגירה"
              >
                <X size={16} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <TypeTools item={notesItem} spacious />
            </div>
          </div>
        </div>
      )}
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
          <div className="relative grid h-10 w-10 place-items-center">
            <ProgressRing ratio={progress.ratio} size={40} color={type.color} className="absolute inset-0" />
            <span className="text-[9px] font-extrabold text-slate-600">{progress.done}</span>
          </div>
        )}
        {type.template === "action" && (
          <span
            className={`grid h-6 w-6 place-items-center rounded-md border ${
              item.action_done ? "bg-emerald-500 text-white" : "border-slate-300"
            }`}
          >
            {item.action_done ? "✓" : ""}
          </span>
        )}
        {type.template === "thought" && (
          <span className="text-base" style={{ color: type.color }}>
            ▼
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-bold text-slate-800">{item.title}</div>
          {type.template === "action" && dueText(item) && (
            <div className="truncate text-[11px] font-bold text-emerald-600">{dueText(item)}</div>
          )}
        </div>
      </button>
      <button
        type="button"
        onClick={onSource}
        className="px-3 pb-1 text-[11px] font-bold text-slate-400"
      >
        לעולם המקור
      </button>
      {open && <TypeTools item={item} />}
    </div>
  );
}
