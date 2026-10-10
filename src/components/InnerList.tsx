import { Check, ChevronLeft, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PALETTE } from "../lib/defaults";
import {
  computeStreak,
  hasDate,
  trackingProgress,
} from "../lib/tracking";
import { useApp } from "../state/AppProvider";
import type { Bubble } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";

const DAY_PRESETS = [21, 30, 60, 90, 120];

export function InnerList({ items }: { items: Bubble[] }) {
  const {
    childrenOf,
    updateBubble,
    addListItem,
    deleteBubble,
    setDrill,
    markToday,
    unmarkToday,
    minusDay,
    resetTracking,
    focusListAdd,
  } = useApp();
  const [draft, setDraft] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
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
          return (
            <div key={item.id} className="rounded-2xl bg-white shadow-soft">
              <div
                className="flex min-h-12 items-center gap-1.5 px-2"
                onClick={() => {
                  if (item.is_tracking) setOpenId(open ? null : item.id);
                }}
              >
                {item.is_tracking ? (
                  <span
                    aria-hidden
                    className="grid h-10 w-8 place-items-center text-xl leading-none"
                    style={{ color: item.color }}
                  >
                    ▼
                  </span>
                ) : (
                  <span className="w-2" />
                )}
                <input
                  value={item.title}
                  onChange={(e) => updateBubble(item.id, { title: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={() => {
                    if (item.is_tracking) setOpenId(item.id);
                  }}
                  className="h-11 min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-slate-800 outline-none"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = !item.is_tracking;
                    updateBubble(item.id, { is_tracking: next });
                    setOpenId(next ? item.id : null);
                  }}
                  className={`h-8 rounded-lg px-2 text-[11px] font-extrabold ${
                    item.is_tracking
                      ? "bg-sky-50 text-sky-600"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  מעקב
                </button>
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
              {item.is_tracking && open && (
                <ItemTrackingPanel
                  item={item}
                  onChange={(patch) => updateBubble(item.id, patch)}
                  onDone={() => markToday(item.id)}
                  onUnmark={() => unmarkToday(item.id)}
                  onMinus={() => minusDay(item.id)}
                  onReset={() => resetTracking(item.id)}
                />
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

function ItemTrackingPanel({
  item,
  onChange,
  onDone,
  onUnmark,
  onMinus,
  onReset,
}: {
  item: Bubble;
  onChange: (patch: Partial<Bubble>) => void;
  onDone: () => void;
  onUnmark: () => void;
  onMinus: () => void;
  onReset: () => void;
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  const progress = trackingProgress(item);
  const doneToday = hasDate(item.tracking_history);
  const streak = useMemo(
    () =>
      computeStreak(
        item.tracking_history,
        item.streak_mode,
        item.weekly_frequency,
      ),
    [item.tracking_history, item.streak_mode, item.weekly_frequency],
  );

  return (
    <div className="space-y-2.5 border-t border-slate-100 px-3 py-3">
      <div className="flex items-center justify-between text-xs font-bold text-slate-500">
        <span>
          {progress.done}/{progress.target} ימים
        </span>
        <span>רצף {streak}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full"
          style={{
            width: `${progress.ratio * 100}%`,
            background: item.color,
          }}
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PALETTE.slice(0, 8).map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange({ color })}
            className="h-6 w-6 rounded-full border-2"
            style={{
              background: color,
              borderColor: item.color === color ? "#0f172a" : "transparent",
            }}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={doneToday ? onUnmark : onDone}
          className={`flex h-11 items-center justify-center gap-1 rounded-xl text-xs font-extrabold ${
            doneToday ? "bg-slate-100 text-slate-600" : "bg-sky-500 text-white"
          }`}
        >
          <Check size={14} />
          {doneToday ? "לא בוצע" : "בוצע היום ✓"}
        </button>
        <button
          type="button"
          onClick={onMinus}
          className="h-11 rounded-xl bg-slate-50 text-xs font-bold text-slate-600"
        >
          החסר יום אחד (-1)
        </button>
      </div>
      <button
        type="button"
        onClick={() => setConfirmReset(true)}
        className="h-10 w-full rounded-xl bg-rose-50 text-xs font-bold text-rose-500"
      >
        איפוס מעקב להתחלה
      </button>

      <div className="text-[11px] font-bold text-slate-400">ימי יעד</div>
      <div className="flex flex-wrap gap-1.5">
        {DAY_PRESETS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange({ target_days: n })}
            className={`h-8 rounded-lg px-2.5 text-xs font-bold ${
              item.target_days === n
                ? "bg-slate-900 text-white"
                : "bg-slate-50 text-slate-600"
            }`}
          >
            {n}
          </button>
        ))}
        <input
          type="number"
          min={1}
          value={item.target_days}
          onChange={(e) =>
            onChange({ target_days: Math.max(1, Number(e.target.value) || 1) })
          }
          className="h-8 w-14 rounded-lg bg-slate-50 text-center text-xs font-bold outline-none"
        />
      </div>

      <div className="flex h-11 items-center justify-between rounded-xl bg-slate-50 px-3">
        <span className="text-xs font-bold text-slate-600">תדירות שבועית</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-lg bg-white"
            onClick={() =>
              onChange({
                weekly_frequency: Math.max(1, item.weekly_frequency - 1),
              })
            }
          >
            −
          </button>
          <span className="w-10 text-center text-sm font-extrabold">
            {item.weekly_frequency}/7
          </span>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-lg bg-white"
            onClick={() =>
              onChange({
                weekly_frequency: Math.min(7, item.weekly_frequency + 1),
              })
            }
          >
            +
          </button>
        </div>
      </div>

      <div className="text-[11px] font-bold text-slate-400">הערות וצעדים</div>
      <textarea
        value={item.notes}
        onChange={(e) => onChange({ notes: e.target.value })}
        rows={3}
        placeholder="פירוט, צעדים והערות לפריט…"
        className="w-full resize-none rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none"
      />

      <ConfirmDialog
        open={confirmReset}
        title="לאפס את המעקב?"
        body="ההיסטוריה והרצף יימחקו."
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
