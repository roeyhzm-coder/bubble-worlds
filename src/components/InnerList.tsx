import { ChevronDown, ChevronUp, Plus, Trash2, Trophy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { findTriangle } from "../lib/triangles";
import { useApp } from "../state/AppProvider";
import type { Bubble } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";
import { TriangleGlyph, TrianglePicker, TypeTools } from "./ItemTools";

export function InnerList({ items }: { items: Bubble[] }) {
  const {
    snapshot,
    childrenOf,
    updateBubble,
    addListItem,
    deleteBubble,
    setDrill,
    setTriangleType,
    focusListAdd,
    drillKey,
    saveBubbleAsSuccess,
  } = useApp();
  const [draft, setDraft] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const addRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setOpenId(null);
  }, [drillKey]);

  useEffect(() => {
    if (!focusListAdd) return;
    addRef.current?.focus();
  }, [focusListAdd]);

  const submit = () => {
    const title = draft.trim();
    if (!title) return;
    addListItem(title);
    setDraft("");
  };

  const toggle = (id: string) => {
    setOpenId((current) => (current === id ? null : id));
  };

  return (
    <div className="flex h-full min-w-0 flex-col overflow-x-hidden px-3 pb-24">
      <form
        className="mb-2 flex h-12 items-center gap-2 rounded-2xl bg-white px-3 shadow-soft"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Plus size={16} className="text-slate-400" />
        <input
          ref={addRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="פריט חדש לרשימה…"
          className="h-11 min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none"
        />
      </form>

      {openId && items.length > 1 && (
        <button
          type="button"
          onClick={() => setOpenId(null)}
          className="mb-2 h-8 self-start rounded-lg px-2 text-[11px] font-extrabold text-slate-500"
        >
          כיווץ הכל
        </button>
      )}

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden no-scrollbar">
        {items.length === 0 && (
          <div className="grid h-32 place-items-center text-sm text-slate-400">
            הרשימה ריקה. כתבו שם ולחצו Enter.
          </div>
        )}
        {items.map((item) => {
          const kids = childrenOf(item.id).length;
          const open = openId === item.id;
          const type = findTriangle(snapshot.triangleTypes, item.triangle_id);
          const plain = !type;
          return (
            <div key={item.id} className="rounded-2xl bg-white shadow-soft">
              <div className="flex min-h-12 items-center gap-1 px-2">
                {plain ? (
                  <button
                    type="button"
                    onClick={() => toggle(item.id)}
                    className="grid h-10 w-8 shrink-0 place-items-center text-sm font-bold text-slate-300"
                    aria-label="ללא משולש"
                  >
                    ∅
                  </button>
                ) : (
                  <TriangleGlyph color={type.color} onClick={() => toggle(item.id)} />
                )}
                <button
                  type="button"
                  onClick={() => toggle(item.id)}
                  className="flex min-h-12 min-w-0 flex-1 items-center gap-1 text-start"
                >
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-slate-800">
                    {item.title || "ללא שם"}
                  </span>
                  {open ? (
                    <ChevronUp size={16} className="shrink-0 text-slate-400" />
                  ) : (
                    <ChevronDown size={16} className="shrink-0 text-slate-400" />
                  )}
                </button>
                {kids > 0 && (
                  <button
                    type="button"
                    onClick={() => setDrill({ kind: "bubble", id: item.id })}
                    className="grid h-10 w-8 shrink-0 place-items-center text-slate-400"
                    aria-label="כניסה לעולם"
                  >
                    ‹
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (saveBubbleAsSuccess(item.id)) setSavedId(item.id);
                  }}
                  className={`grid h-10 w-8 shrink-0 place-items-center ${
                    savedId === item.id ? "text-amber-500" : "text-amber-400"
                  }`}
                  aria-label="שמור כהצלחה"
                >
                  <Trophy size={15} />
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
              {open && (
                <div className="border-t border-slate-100">
                  <div className="px-3 pt-2">
                    <input
                      value={item.title}
                      onChange={(e) => updateBubble(item.id, { title: e.target.value })}
                      className="mb-2 h-10 w-full rounded-xl bg-slate-50 px-3 text-sm font-semibold outline-none"
                    />
                    <TrianglePicker
                      value={item.triangle_id}
                      onChange={(id) => setTriangleType(item.id, id)}
                    />
                    {plain && (
                      <textarea
                        value={item.notes}
                        onChange={(e) => updateBubble(item.id, { notes: e.target.value })}
                        rows={3}
                        placeholder="הערה חופשית…"
                        className="mt-2 w-full resize-none rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none"
                      />
                    )}
                  </div>
                  {!plain && <TypeTools item={item} />}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="למחוק את הפריט?"
        body="הפריט והמעקב שלו יימחקו."
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) deleteBubble(pendingDelete);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
