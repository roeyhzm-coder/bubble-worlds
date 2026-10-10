import { ChevronLeft, Plus, Trash2 } from "lucide-react";
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
  } = useApp();
  const [draft, setDraft] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [pickerId, setPickerId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const addRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="flex h-full flex-col px-3 pb-24">
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

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto no-scrollbar">
        {items.length === 0 && (
          <div className="grid h-32 place-items-center text-sm text-slate-400">
            הרשימה ריקה. כתבו שם ולחצו Enter.
          </div>
        )}
        {items.map((item) => {
          const kids = childrenOf(item.id).length;
          const open = openId === item.id;
          const type = findTriangle(snapshot.triangleTypes, item.triangle_id);
          return (
            <div key={item.id} className="rounded-2xl bg-white shadow-soft">
              <div
                className="flex min-h-12 items-center gap-1.5 px-2"
                onClick={() => setOpenId(open ? null : item.id)}
              >
                <TriangleGlyph
                  color={type?.color ?? item.color}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPickerId(pickerId === item.id ? null : item.id);
                    setOpenId(item.id);
                  }}
                />
                <input
                  value={item.title}
                  onChange={(e) => updateBubble(item.id, { title: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  className="h-11 min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-slate-800 outline-none"
                />
                {kids > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDrill({ kind: "bubble", id: item.id });
                    }}
                    className="grid h-10 w-9 place-items-center text-slate-400"
                    aria-label="כניסה לעולם"
                  >
                    <ChevronLeft size={18} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingDelete(item.id);
                  }}
                  className="grid h-10 w-9 place-items-center text-rose-400"
                  aria-label="מחיקה"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              {pickerId === item.id && (
                <div className="px-3 pb-2" onClick={(e) => e.stopPropagation()}>
                  <TrianglePicker
                    value={item.triangle_id}
                    onChange={(id) => {
                      setTriangleType(item.id, id);
                      setPickerId(null);
                    }}
                  />
                </div>
              )}
              {open && <TypeTools item={item} />}
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
