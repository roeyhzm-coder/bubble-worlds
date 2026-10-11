import { Trash2, Trophy, X } from "lucide-react";
import { useMemo, useState } from "react";
import { formatSuccessDate } from "../lib/successes";
import { useApp } from "../state/AppProvider";
import type { Success } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";
import { Portal } from "./Portal";

export function Successes() {
  const { snapshot, addSuccess, updateSuccess, deleteSuccess } = useApp();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const items = useMemo(
    () => [...snapshot.successes].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [snapshot.successes],
  );
  const viewing = items.find((item) => item.id === viewId) ?? null;

  const submitManual = () => {
    const title = draftTitle.trim();
    if (!title) return;
    addSuccess({
      title,
      notes: draftNotes.trim(),
      source_type: "manual",
      category_name: "ידני",
    });
    setDraftTitle("");
    setDraftNotes("");
  };

  return (
    <section className="flex h-full min-w-0 flex-col overflow-x-hidden bg-gradient-to-b from-amber-50/80 to-transparent">
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-amber-500" />
          <div className="text-[15px] font-extrabold text-slate-800">
            {snapshot.pageLabels.successes}
          </div>
        </div>
        <div className="text-[11px] font-bold text-slate-400">
          כספת הישגים · {items.length} שמורים
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden px-3 pb-24 no-scrollbar">
        <form
          className="rounded-2xl bg-white/90 p-2.5 shadow-soft ring-1 ring-amber-100"
          onSubmit={(e) => {
            e.preventDefault();
            submitManual();
          }}
        >
          <input
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            placeholder="הוסיפו הצלחה ידנית…"
            className="h-10 w-full bg-transparent px-1 text-sm font-extrabold text-slate-800 outline-none"
          />
          <textarea
            value={draftNotes}
            onChange={(e) => setDraftNotes(e.target.value)}
            rows={2}
            placeholder="פתק סיכום קצר…"
            className="w-full resize-none bg-transparent px-1 text-[12px] text-slate-600 outline-none"
          />
        </form>

        {items.length === 0 && (
          <div className="grid h-32 place-items-center text-center text-sm text-slate-400">
            עדיין אין הצלחות. שמרו פריט עם 🏆 או הוסיפו כאן.
          </div>
        )}

        {items.map((item) => (
          <article key={item.id} className="rounded-2xl bg-white px-3 py-2.5 shadow-soft ring-1 ring-amber-100">
            <div className="flex min-h-[44px] items-center gap-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-500">
                <Trophy size={16} />
              </span>
              <button
                type="button"
                onClick={() => setViewId(item.id)}
                className="min-w-0 flex-1 text-start"
              >
                <div className="truncate text-[14px] font-extrabold text-slate-800">{item.title}</div>
                <div className="truncate text-[11px] font-bold text-amber-700/70">
                  {formatSuccessDate(item.created_at)}
                  {item.category_name ? ` · ${item.category_name}` : ""}
                </div>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPendingDelete(item.id);
                }}
                className="grid h-10 w-8 shrink-0 place-items-center text-rose-400"
                aria-label="מחיקה"
              >
                <Trash2 size={15} />
              </button>
            </div>
            {item.notes && (
              <p className="mt-1 line-clamp-2 px-1 text-[12px] leading-snug text-slate-500">{item.notes}</p>
            )}
          </article>
        ))}
      </div>

      <SuccessView
        item={viewing}
        onClose={() => setViewId(null)}
        onChangeNotes={(notes) => viewing && updateSuccess(viewing.id, { notes })}
        onDelete={() => {
          if (!viewing) return;
          setPendingDelete(viewing.id);
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="למחוק את ההצלחה?"
        body="ההישג יוסר מהכספת. הפריט המקורי לא יימחק."
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) deleteSuccess(pendingDelete);
          setPendingDelete(null);
          if (viewId === pendingDelete) setViewId(null);
        }}
      />
    </section>
  );
}

function SuccessView({
  item,
  onClose,
  onChangeNotes,
  onDelete,
}: {
  item: Success | null;
  onClose: () => void;
  onChangeNotes: (notes: string) => void;
  onDelete: () => void;
}) {
  if (!item) return null;
  return (
    <Portal>
      <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-900/30 px-6" onClick={onClose}>
        <div
          className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-soft ring-1 ring-amber-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[11px] font-extrabold text-amber-600">הצלחה</div>
              <h3 className="text-base font-extrabold text-slate-800">{item.title}</h3>
              <div className="text-[11px] font-bold text-slate-400">
                {formatSuccessDate(item.created_at)}
                {item.category_name ? ` · ${item.category_name}` : ""}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500"
              aria-label="סגירה"
            >
              <X size={16} />
            </button>
          </div>
          <textarea
            value={item.notes}
            onChange={(e) => onChangeNotes(e.target.value)}
            rows={5}
            placeholder="פתק סיכום…"
            className="mt-3 w-full resize-none rounded-xl bg-amber-50/70 px-3 py-2 text-sm text-slate-700 outline-none"
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-rose-50 text-sm font-bold text-rose-500"
          >
            <Trash2 size={15} />
            מחיקה
          </button>
        </div>
      </div>
    </Portal>
  );
}
