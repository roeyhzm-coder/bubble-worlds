import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { dueText } from "../lib/triangles";
import { isItemCompleted, sessionProgress, trackingProgress } from "../lib/tracking";
import { useApp } from "../state/AppProvider";
import type { Bubble, TriangleType } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";
import { CompletionBar, NoteIndicator, SessionBadge, TypeTools } from "./ItemTools";
import { ProgressRing } from "./ProgressRing";

export function FocusHub() {
  const { snapshot, setPage, setDrill } = useApp();
  const [openId, setOpenId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const groups = useMemo(() => {
    return snapshot.triangleTypes
      .slice()
      .sort((a, b) => a.order_index - b.order_index)
      .map((type) => ({
        type,
        items: snapshot.bubbles.filter((item) => item.triangle_id === type.id && !item.archived),
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
                  onDelete={() => setPendingDelete(item.id)}
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
      <HubDeleteDialog id={pendingDelete} onClose={() => setPendingDelete(null)} />
    </section>
  );
}

function HubDeleteDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { deleteBubble } = useApp();
  return (
    <ConfirmDialog
      open={Boolean(id)}
      title="למחוק את הפריט?"
      body="הפריט יימחק מהעולם וממוקדי הפוקוס."
      onCancel={onClose}
      onConfirm={() => {
        if (id) deleteBubble(id);
        onClose();
      }}
    />
  );
}

function HubCard({
  item,
  type,
  open,
  onToggle,
  onDelete,
  onSource,
}: {
  item: Bubble;
  type: TriangleType;
  open: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onSource: () => void;
}) {
  const { updateBubble } = useApp();
  const progress = trackingProgress(item);
  const completed = isItemCompleted(item, type.template);
  return (
    <div className={`rounded-2xl bg-white ${completed ? "ring-2 ring-amber-300" : ""}`}>
      <div className="flex min-h-12 w-full items-center gap-1 px-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex min-h-12 min-w-0 flex-1 items-center gap-2 text-start"
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
        {type.template === "counter" && <SessionBadge item={item} color={type.color} />}
        {type.template === "thought" && (
          <span className="shrink-0 text-base" style={{ color: type.color }}>
            ▼
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="truncate text-[14px] font-bold text-slate-800">{item.title || "ללא שם"}</span>
            <NoteIndicator notes={item.notes} />
          </div>
          {type.template === "counter" && (
            <div className="truncate text-[11px] font-bold text-violet-700">
              {sessionProgress(item).done} / {sessionProgress(item).target} פעמים
            </div>
          )}
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
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="grid h-10 w-8 shrink-0 place-items-center text-rose-400"
          aria-label="מחיקה"
        >
          <Trash2 size={15} />
        </button>
      </div>
      <CompletionBar item={item} onDelete={onDelete} />
      {open && (
        <>
          <div className="px-3 pb-1">
            <input
              value={item.title}
              onChange={(e) => updateBubble(item.id, { title: e.target.value })}
              placeholder="שם הפריט"
              aria-label="שם הפריט"
              className="h-10 w-full rounded-xl bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none"
            />
          </div>
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
