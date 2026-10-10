import { AnimatePresence, motion } from "framer-motion";
import { Check, Minus, RotateCcw, Trash2, DoorOpen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PALETTE } from "../lib/defaults";
import { computeStreak, statusLabel, trackingProgress } from "../lib/tracking";
import { useApp } from "../state/AppProvider";
import type { Bubble, BubbleStatus, Category, StreakMode } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";

const STATUSES: BubbleStatus[] = [
  "active_tracking",
  "focus",
  "deep_thought",
  "default",
];

const STREAKS: StreakMode[] = ["flexible", "strict", "cumulative"];
const DAY_PRESETS = [21, 30, 60, 90, 120];

export function EditDrawer() {
  const {
    editing,
    closeEditor,
    snapshot,
    updateCategory,
    updateBubble,
    deleteCategory,
    deleteBubble,
    setDrill,
    setPage,
    markToday,
    minusDay,
    resetTracking,
    childrenOf,
  } = useApp();

  const category = snapshot.categories.find(
    (c) => editing?.type === "category" && c.id === editing.id,
  );
  const bubble = snapshot.bubbles.find(
    (b) => editing?.type === "bubble" && b.id === editing.id,
  );
  const open = Boolean(category || bubble);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end bg-slate-900/25"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeEditor}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="max-h-[86vh] w-full overflow-y-auto rounded-t-3xl bg-white px-4 pb-8 pt-3 shadow-soft no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200" />
            {category && (
              <CategoryForm
                category={category}
                onChange={(patch) => updateCategory(category.id, patch)}
                onDelete={() => deleteCategory(category.id)}
                onOpen={() => {
                  setDrill({ kind: "category", id: category.id });
                  setPage(0);
                  closeEditor();
                }}
              />
            )}
            {bubble && (
              <BubbleForm
                bubble={bubble}
                childCount={childrenOf(bubble.id).length}
                onChange={(patch) => updateBubble(bubble.id, patch)}
                onDelete={() => deleteBubble(bubble.id)}
                onOpen={() => {
                  setDrill({ kind: "bubble", id: bubble.id });
                  setPage(0);
                  closeEditor();
                }}
                onDone={() => markToday(bubble.id)}
                onMinus={() => minusDay(bubble.id)}
                onReset={() => resetTracking(bubble.id)}
                roleColor={snapshot.colorRoles}
              />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CategoryForm({
  category,
  onChange,
  onDelete,
  onOpen,
}: {
  category: Category;
  onChange: (patch: Partial<Category>) => void;
  onDelete: () => void;
  onOpen: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="space-y-3">
      <RowLabel label="שם העולם" />
      <input
        value={category.name}
        onChange={(e) => onChange({ name: e.target.value })}
        className="h-11 w-full rounded-xl bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none ring-1 ring-slate-200 focus:ring-slate-400"
      />
      <RowLabel label="צבע" />
      <ColorRow
        value={category.color}
        onChange={(color) => onChange({ color })}
      />
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onOpen}
          className="flex h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-slate-900 text-sm font-semibold text-white"
        >
          <DoorOpen size={16} />
          כניסה
        </button>
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="grid h-11 w-11 place-items-center rounded-xl bg-rose-50 text-rose-500"
          aria-label="מחיקה"
        >
          <Trash2 size={16} />
        </button>
      </div>
      <ConfirmDialog
        open={confirm}
        title="למחוק את העולם?"
        body="כל הבועות בתוכו יימחקו גם כן."
        onCancel={() => setConfirm(false)}
        onConfirm={onDelete}
      />
    </div>
  );
}

function BubbleForm({
  bubble,
  childCount,
  onChange,
  onDelete,
  onOpen,
  onDone,
  onMinus,
  onReset,
  roleColor,
}: {
  bubble: Bubble;
  childCount: number;
  onChange: (patch: Partial<Bubble>) => void;
  onDelete: () => void;
  onOpen: () => void;
  onDone: () => void;
  onMinus: () => void;
  onReset: () => void;
  roleColor: Record<BubbleStatus, string>;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [trackOpen, setTrackOpen] = useState(bubble.is_tracking);
  const [pop, setPop] = useState(false);
  const progress = trackingProgress(bubble);
  const streak = useMemo(
    () =>
      computeStreak(
        bubble.tracking_history,
        bubble.streak_mode,
        bubble.weekly_frequency,
      ),
    [bubble.tracking_history, bubble.streak_mode, bubble.weekly_frequency],
  );

  useEffect(() => {
    setTrackOpen(bubble.is_tracking);
  }, [bubble.is_tracking]);

  return (
    <div className="space-y-3">
      <RowLabel label="כותרת" />
      <input
        value={bubble.title}
        onChange={(e) => onChange({ title: e.target.value })}
        className="h-11 w-full rounded-xl bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none ring-1 ring-slate-200 focus:ring-slate-400"
      />
      <RowLabel label="הערות" />
      <textarea
        value={bubble.notes}
        onChange={(e) => onChange({ notes: e.target.value })}
        rows={3}
        className="w-full resize-none rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none ring-1 ring-slate-200 focus:ring-slate-400"
      />

      <RowLabel label="סטטוס" />
      <div className="grid grid-cols-2 gap-1.5">
        {STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() =>
              onChange({
                status,
                color: roleColor[status],
                is_tracking: status === "active_tracking" ? true : bubble.is_tracking,
              })
            }
            className={`h-11 rounded-xl text-xs font-bold ${
              bubble.status === status
                ? "bg-slate-900 text-white"
                : "bg-slate-50 text-slate-600"
            }`}
          >
            {statusLabel(status)}
          </button>
        ))}
      </div>

      <RowLabel label="צבע" />
      <ColorRow value={bubble.color} onChange={(color) => onChange({ color })} />

      <div className="flex h-12 items-center justify-between rounded-xl bg-slate-50 px-3">
        <span className="text-xs font-bold text-slate-600">גודל בועה</span>
        <input
          type="range"
          min={0.7}
          max={1.8}
          step={0.05}
          value={bubble.size_multiplier}
          onChange={(e) =>
            onChange({ size_multiplier: Number(e.target.value) })
          }
          className="mx-3 flex-1 accent-slate-700"
        />
        <span className="w-8 text-end text-[11px] text-slate-400">
          {bubble.size_multiplier.toFixed(2)}
        </span>
      </div>

      <button
        type="button"
        onClick={() => {
          const next = !bubble.is_tracking;
          onChange({
            is_tracking: next,
            status: next ? "active_tracking" : bubble.status,
            color: next ? roleColor.active_tracking : bubble.color,
          });
          setTrackOpen(next);
        }}
        className="flex h-11 w-full items-center justify-between rounded-xl bg-slate-50 px-3 text-sm font-bold text-slate-700"
      >
        <span>מנוע מעקב</span>
        <span className="text-xs text-slate-400">
          {bubble.is_tracking ? "פעיל" : "כבוי"}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {(bubble.is_tracking || trackOpen) && bubble.is_tracking && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden rounded-2xl bg-sky-50/80 p-3"
          >
            <div className="mb-2 text-center text-xs font-bold text-slate-500">
              {progress.done}/{progress.target} · רצף {streak}
            </div>
            <motion.button
              type="button"
              onClick={() => {
                onDone();
                setPop(true);
                window.setTimeout(() => setPop(false), 500);
              }}
              animate={{ scale: pop ? 1.04 : 1 }}
              className="mb-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-sky-500 text-sm font-extrabold text-white shadow-soft"
            >
              <Check size={18} />
              בוצע היום! ✓
            </motion.button>
            <div className="mb-2 grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={onMinus}
                className="flex h-11 items-center justify-center gap-1 rounded-xl bg-white text-xs font-bold text-slate-600"
              >
                <Minus size={14} />
                החסר יום אחד
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="flex h-11 items-center justify-center gap-1 rounded-xl bg-white text-xs font-bold text-rose-500"
              >
                <RotateCcw size={14} />
                איפוס מעקב
              </button>
            </div>
            <RowLabel label="ימי יעד" />
            <div className="mb-2 flex flex-wrap gap-1.5">
              {DAY_PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onChange({ target_days: n })}
                  className={`h-9 rounded-lg px-2.5 text-xs font-bold ${
                    bubble.target_days === n
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-600"
                  }`}
                >
                  {n}
                </button>
              ))}
              <input
                type="number"
                min={1}
                value={bubble.target_days}
                onChange={(e) =>
                  onChange({
                    target_days: Math.max(1, Number(e.target.value) || 1),
                  })
                }
                className="h-9 w-16 rounded-lg bg-white px-2 text-center text-xs font-bold text-slate-700 outline-none"
              />
            </div>
            <div className="mb-2 flex h-11 items-center justify-between rounded-xl bg-white px-3">
              <span className="text-xs font-bold text-slate-600">
                תדירות שבועית
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100"
                  onClick={() =>
                    onChange({
                      weekly_frequency: Math.max(1, bubble.weekly_frequency - 1),
                    })
                  }
                >
                  −
                </button>
                <span className="w-10 text-center text-sm font-extrabold">
                  {bubble.weekly_frequency}/7
                </span>
                <button
                  type="button"
                  className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100"
                  onClick={() =>
                    onChange({
                      weekly_frequency: Math.min(7, bubble.weekly_frequency + 1),
                    })
                  }
                >
                  +
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {STREAKS.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onChange({ streak_mode: mode })}
                  className={`h-10 rounded-xl text-[11px] font-bold ${
                    bubble.streak_mode === mode
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-600"
                  }`}
                >
                  {mode === "strict"
                    ? "קפדני"
                    : mode === "flexible"
                      ? "גמיש"
                      : "מצטבר"}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onOpen}
          className="flex h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-slate-900 text-sm font-semibold text-white"
        >
          <DoorOpen size={16} />
          כניסה לעולם
          {childCount > 0 ? ` (${childCount})` : ""}
        </button>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="grid h-11 w-11 place-items-center rounded-xl bg-rose-50 text-rose-500"
          aria-label="מחיקה"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="למחוק את הבועה?"
        body="גם כל תתי-הבועות שלה יימחקו."
        onCancel={() => setConfirmDelete(false)}
        onConfirm={onDelete}
      />
      <ConfirmDialog
        open={confirmReset}
        title="לאפס את המעקב?"
        body="ההיסטוריה והרצף יימחקו, והספירה תתחיל מחדש."
        confirmLabel="איפוס"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          onReset();
          setConfirmReset(false);
        }}
      />
    </div>
  );
}

function RowLabel({ label }: { label: string }) {
  return <div className="text-[11px] font-bold text-slate-400">{label}</div>;
}

function ColorRow({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className="h-8 w-8 rounded-full border-2"
          style={{
            background: color,
            borderColor: value === color ? "#0f172a" : "transparent",
          }}
        />
      ))}
    </div>
  );
}
