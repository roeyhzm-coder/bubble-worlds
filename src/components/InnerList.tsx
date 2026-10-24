import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { sessionProgress } from "../lib/tracking";
import { findTriangle } from "../lib/triangles";
import { useApp } from "../state/AppProvider";
import type { Bubble } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  CompletionBar,
  DoneEditingButton,
  NoteIndicator,
  NotesField,
  QuickCheck,
  TitleField,
  TypeSwitcher,
  TypeTools,
  accentFill,
  accentRing,
} from "./ItemTools";

const LIST_ACCENT = "#6366f1";

export function InnerList({ items }: { items: Bubble[] }) {
  const {
    snapshot,
    childrenOf,
    addListItem,
    deleteBubble,
    setDrill,
    setTriangleType,
    focusListAdd,
    drillKey,
  } = useApp();
  const [draft, setDraft] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    setOpenId(null);
  }, [drillKey]);

  const submit = () => {
    const title = draftRef.current.trim();
    if (!title) return false;
    addListItem(title);
    setDraft("");
    return true;
  };

  // The floating + saves a typed draft right away; otherwise it just focuses the input.
  useEffect(() => {
    if (!focusListAdd) return;
    submit();
    addRef.current?.focus();
  }, [focusListAdd]);

  const toggle = (id: string) => {
    setOpenId((current) => (current === id ? null : id));
  };

  const hasDraft = draft.trim().length > 0;

  return (
    <div className="flex h-full min-w-0 flex-col overflow-x-hidden px-3 pb-24">
      <form
        className="card mb-2 flex h-12 items-center gap-2 pe-1.5 ps-3 focus-within:ring-2 focus-within:ring-indigo-200"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
          addRef.current?.focus();
        }}
      >
        <Plus size={16} className="shrink-0 text-slate-400" />
        <input
          ref={addRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="פריט חדש לרשימה…"
          enterKeyHint="done"
          className="h-11 min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none"
        />
        <button
          type="submit"
          // Keep the keyboard open on mobile: don't steal focus from the input.
          onMouseDown={(e) => e.preventDefault()}
          aria-disabled={!hasDraft}
          className={`h-9 shrink-0 rounded-xl px-3 text-[12px] font-extrabold ${
            hasDraft ? "text-white" : "bg-slate-100 text-slate-400"
          }`}
          style={hasDraft ? accentFill(LIST_ACCENT) : undefined}
        >
          הוסף +
        </button>
      </form>

      {openId && items.length > 1 && (
        <button
          type="button"
          onClick={() => setOpenId(null)}
          className="mb-2 h-8 self-start rounded-lg px-2 text-[11px] font-extrabold text-slate-500 hover:bg-white/70"
        >
          כיווץ הכל
        </button>
      )}

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden no-scrollbar">
        {items.length === 0 && (
          <div className="grid h-32 place-items-center text-sm text-slate-400">
            הרשימה ריקה. כתבו שם ולחצו "הוסף +".
          </div>
        )}
        {items.map((item) => {
          const kids = childrenOf(item.id).length;
          const open = openId === item.id;
          const type = findTriangle(snapshot.triangleTypes, item.triangle_id);
          const plain = !type;
          return (
            <div
              key={item.id}
              className={`card ${open ? "shadow-md" : ""}`}
              style={open ? accentRing(type?.color ?? "#94a3b8") : undefined}
            >
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
                  <QuickCheck item={item} type={type} size={32} />
                )}
                <button
                  type="button"
                  onClick={() => toggle(item.id)}
                  aria-expanded={open}
                  className="flex min-h-12 min-w-0 flex-1 items-center gap-1 text-start"
                >
                  <span className="min-w-0 truncate text-[15px] font-semibold text-slate-800">
                    {item.title || "ללא שם"}
                  </span>
                  <NoteIndicator notes={item.notes} />
                  <span className="flex-1" />
                  {type?.template === "counter" && (
                    <span className="shrink-0 text-[11px] font-extrabold text-violet-700">
                      {sessionProgress(item).done} / {sessionProgress(item).target}
                    </span>
                  )}
                  <ChevronDown
                    size={16}
                    className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
                  />
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
                    setPendingDelete(item.id);
                  }}
                  className="grid h-10 w-8 shrink-0 place-items-center text-rose-400"
                  aria-label="מחיקה"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              {!plain && <CompletionBar item={item} onDelete={() => setPendingDelete(item.id)} />}
              {open && (
                <div className="border-t border-slate-100">
                  <div className="space-y-2 px-3 pb-1 pt-2">
                    <TitleField item={item} />
                    <TypeSwitcher
                      value={item.triangle_id}
                      onChange={(id) => setTriangleType(item.id, id)}
                    />
                  </div>
                  {plain ? <NotesField item={item} /> : <TypeTools item={item} />}
                  <DoneEditingButton onDone={() => setOpenId(null)} />
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
