import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownUp, ArrowLeftRight, Check, ChevronDown, Plus, Trash2 } from "lucide-react";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { stepOrder } from "../lib/order";
import { sessionProgress } from "../lib/tracking";
import { useEscape } from "../lib/useEscape";
import { findTriangle } from "../lib/triangles";
import { useApp } from "../state/AppProvider";
import type { Bubble, DrillNode } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";
import { Portal } from "./Portal";
import { ReorderButtons } from "./ReorderButtons";
import {
  CompletionBar,
  DoneEditingButton,
  MultiDailyBadge,
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

const MoveItemsModal = lazy(() => import("./MoveItemsModal").then((m) => ({ default: m.MoveItemsModal })));

export function InnerList({ items }: { items: Bubble[] }) {
  const {
    snapshot,
    childrenOf,
    addListItem,
    deleteBubble,
    drill,
    setDrill,
    setTriangleType,
    focusListAdd,
    drillKey,
    page,
    setNavLock,
    reorderItems,
  } = useApp();
  const [draft, setDraft] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [moveIds, setMoveIds] = useState<string[] | null>(null);
  const [reordering, setReordering] = useState(false);
  // The move dialog's code loads on first use, then stays mounted for its exit animation.
  const [moveUsed, setMoveUsed] = useState(false);

  useEffect(() => {
    if (moveIds) setMoveUsed(true);
  }, [moveIds]);
  const [notice, setNotice] = useState<{ text: string; node: DrillNode } | null>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    setOpenId(null);
    setSelecting(false);
    setReordering(false);
    setSelected(new Set());
  }, [drillKey]);

  // A stray horizontal swipe must not carry the user away from an active selection.
  useEffect(() => {
    setNavLock(selecting);
    return () => setNavLock(false);
  }, [selecting, setNavLock]);

  useEscape(selecting && !moveIds, () => exitSelecting());
  useEscape(reordering, () => setReordering(false));

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // Drop selections for items that left this list (moved, deleted, archived).
  useEffect(() => {
    setSelected((current) => {
      const present = new Set(items.map((item) => item.id));
      const kept = [...current].filter((id) => present.has(id));
      return kept.length === current.size ? current : new Set(kept);
    });
  }, [items]);

  const exitSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  const toggleSelected = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = items.length > 0 && selected.size === items.length;

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

      {items.length > 0 && (
        <div className="mb-2 flex min-h-8 flex-wrap items-center gap-1.5">
          {!selecting && items.length > 1 && (
            <button
              type="button"
              onClick={() => {
                setReordering((v) => !v);
                setOpenId(null);
              }}
              aria-pressed={reordering}
              className={`inline-flex h-8 items-center gap-1 rounded-full px-3 text-[11px] font-extrabold ${
                reordering
                  ? "bg-slate-900 text-white shadow-sm"
                  : "border border-slate-200 bg-white/80 text-slate-600 hover:bg-white"
              }`}
            >
              <ArrowDownUp size={13} />
              {reordering ? "סיום סידור" : "סידור"}
            </button>
          )}
          {!reordering && <button
            type="button"
            onClick={() => (selecting ? exitSelecting() : (setSelecting(true), setOpenId(null)))}
            aria-pressed={selecting}
            className={`inline-flex h-8 items-center gap-1 rounded-full px-3 text-[11px] font-extrabold ${
              selecting
                ? "bg-slate-900 text-white shadow-sm"
                : "border border-slate-200 bg-white/80 text-slate-600 hover:bg-white"
            }`}
          >
            <ArrowLeftRight size={13} />
            {selecting ? "סיום בחירה" : "העבר / פצל פריטים"}
          </button>}
          {selecting && (
            <button
              type="button"
              onClick={() => setSelected(allSelected ? new Set() : new Set(items.map((item) => item.id)))}
              className="h-8 rounded-full px-2.5 text-[11px] font-extrabold text-indigo-600 hover:bg-white/70"
            >
              {allSelected ? "נקה בחירה" : "בחר הכל"}
            </button>
          )}
          {!selecting && !reordering && openId && items.length > 1 && (
            <button
              type="button"
              onClick={() => setOpenId(null)}
              className="h-8 rounded-full px-2.5 text-[11px] font-extrabold text-slate-500 hover:bg-white/70"
            >
              כיווץ הכל
            </button>
          )}
        </div>
      )}

      <AnimatePresence>
        {notice && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-2 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-[12px] font-bold text-emerald-800 ring-1 ring-emerald-200"
          >
            <span className="min-w-0 flex-1 truncate">{notice.text}</span>
            <button
              type="button"
              onClick={() => {
                setDrill(notice.node);
                setNotice(null);
              }}
              className="h-7 shrink-0 rounded-full bg-white px-2.5 text-[11px] font-extrabold text-emerald-700 ring-1 ring-emerald-200"
            >
              מעבר ליעד ‹
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden no-scrollbar">
        {items.length === 0 && (
          <div className="grid h-32 place-items-center text-sm text-slate-400">
            הרשימה ריקה. כתבו שם ולחצו "הוסף +".
          </div>
        )}
        {items.map((item, index) => {
          const kids = childrenOf(item.id).length;
          const open = openId === item.id;
          const type = findTriangle(snapshot.triangleTypes, item.triangle_id);
          const plain = !type;
          if (reordering) {
            return (
              <motion.div
                key={item.id}
                layout
                transition={{ type: "spring", stiffness: 520, damping: 38 }}
                className="card flex min-h-14 items-center gap-2 py-1 pe-1.5 ps-3"
              >
                <span className="w-5 shrink-0 text-center text-[11px] font-extrabold text-slate-400">{index + 1}</span>
                {type && (
                  <span className="shrink-0 text-sm" style={{ color: type.color }} aria-hidden="true">
                    ▼
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-slate-800">
                  {item.title || "ללא שם"}
                </span>
                <ReorderButtons
                  title={item.title}
                  isFirst={index === 0}
                  isLast={index === items.length - 1}
                  onMove={(direction) => {
                    const next = stepOrder(items.map((row) => row.id), item.id, direction);
                    if (next) reorderItems(next);
                  }}
                />
              </motion.div>
            );
          }
          if (selecting) {
            const checked = selected.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleSelected(item.id)}
                aria-pressed={checked}
                className={`card flex min-h-12 w-full items-center gap-2 px-3 text-start ${
                  checked ? "border-indigo-300 bg-indigo-50/80 ring-2 ring-indigo-200" : ""
                }`}
              >
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2 ${
                    checked ? "border-transparent text-white" : "border-slate-300 bg-white"
                  }`}
                  style={checked ? accentFill(LIST_ACCENT) : undefined}
                >
                  {checked && <Check size={14} strokeWidth={3} />}
                </span>
                {type && (
                  <span className="shrink-0 text-sm" style={{ color: type.color }}>
                    ▼
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-slate-800">
                  {item.title || "ללא שם"}
                </span>
                {kids > 0 && <span className="shrink-0 text-[10px] font-bold text-slate-400">+{kids} בפנים</span>}
              </button>
            );
          }
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
                    aria-label={`פתיחת ${item.title || "הפריט"} (ללא משולש)`}
                    title="ללא משולש · לחצו לפתיחה"
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
                  {type?.template === "multi_daily" && <MultiDailyBadge item={item} color={type.color} />}
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
                    aria-label={`כניסה אל ${item.title || "הפריט"}`}
                    title={`כניסה אל ${item.title || "הפריט"}`}
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
                  aria-label={`מחיקת ${item.title || "הפריט"}`}
                  title="מחיקה"
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
                  <div className="flex items-center justify-between gap-2 px-3 pb-3">
                    <button
                      type="button"
                      onClick={() => setMoveIds([item.id])}
                      className="inline-flex h-8 items-center gap-1 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-extrabold text-slate-600 hover:bg-slate-50"
                    >
                      <ArrowLeftRight size={13} />
                      העבר לבועה אחרת
                    </button>
                    <DoneEditingButton onDone={() => setOpenId(null)} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Portal>
        <AnimatePresence>
          {selecting && page === 0 && (
            <motion.div
              role="toolbar"
              aria-label="פעולות על הפריטים שנבחרו"
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              className="fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center gap-2 rounded-2xl bg-slate-900/95 p-2 ps-4 text-white shadow-[0_18px_40px_-14px_rgba(15,23,42,0.7)] backdrop-blur"
            >
              <span className="min-w-0 flex-1 truncate text-[13px] font-extrabold">
                {selected.size ? `${selected.size} נבחרו` : "בחרו פריטים להעברה"}
              </span>
              <button
                type="button"
                disabled={!selected.size}
                onClick={() => setMoveIds([...selected])}
                className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 px-3 text-[12px] font-extrabold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] disabled:from-slate-600 disabled:to-slate-600 disabled:text-slate-400"
              >
                העבר אל... <ArrowLeftRight size={14} />
              </button>
              <button
                type="button"
                onClick={exitSelecting}
                className="h-10 shrink-0 rounded-xl px-3 text-[12px] font-extrabold text-slate-300 hover:bg-white/10"
              >
                ביטול
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </Portal>

      {moveUsed && (
        <Suspense fallback={null}>
          <MoveItemsModal
            open={Boolean(moveIds)}
            itemIds={moveIds ?? []}
            source={drill}
            onClose={() => setMoveIds(null)}
            onMoved={({ count, label, node }) => {
              setMoveIds(null);
              exitSelecting();
              setOpenId(null);
              setNotice({
                text: count ? `הועברו ${count} פריטים ל"${label}" ✓` : "לא הועבר דבר — היעד זהה למקור",
                node,
              });
            }}
          />
        </Suspense>
      )}

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
