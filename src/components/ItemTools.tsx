import { Check, Plus, Trash2 } from "lucide-react";
import { useMemo, useState, type MouseEvent } from "react";
import { PALETTE } from "../lib/defaults";
import {
  computeStreak,
  hasDate,
  trackingProgress,
} from "../lib/tracking";
import { WEEKDAYS, dueText, findTriangle, nextWeekdayIso } from "../lib/triangles";
import { useApp } from "../state/AppProvider";
import type { Bubble, ToolTemplate, TriangleType } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";
import { ProgressRing } from "./ProgressRing";

const DAY_PRESETS = [21, 30, 60, 90, 120];

export function TriangleGlyph({
  color,
  onClick,
}: {
  color: string;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid h-10 w-8 shrink-0 place-items-center text-lg leading-none"
      style={{ color }}
      aria-label="סוג משולש"
    >
      ▼
    </button>
  );
}

export function TrianglePicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string) => void;
}) {
  const { snapshot } = useApp();
  return (
    <div className="flex flex-wrap gap-1.5">
      {snapshot.triangleTypes.map((type) => (
        <button
          key={type.id}
          type="button"
          onClick={() => onChange(type.id)}
          className={`inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-extrabold ${
            value === type.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
          }`}
        >
          <span style={{ color: value === type.id ? "#fff" : type.color }}>▼</span>
          {type.name}
        </button>
      ))}
    </div>
  );
}

export function TypeTools({
  item,
  spacious = false,
}: {
  item: Bubble;
  spacious?: boolean;
}) {
  const { snapshot } = useApp();
  const live = snapshot.bubbles.find((row) => row.id === item.id) ?? item;
  const type = findTriangle(snapshot.triangleTypes, live.triangle_id);
  const template: ToolTemplate = type?.template ?? "tracking";
  if (template === "action") return <ActionTools item={live} />;
  if (template === "thought") return <ThoughtTools item={live} spacious={spacious} />;
  return <TrackingTools item={live} color={type?.color ?? live.color} />;
}

function TrackingTools({ item, color }: { item: Bubble; color: string }) {
  const { updateBubble, markToday, unmarkToday, minusDay, resetTracking } = useApp();
  const [confirmReset, setConfirmReset] = useState(false);
  const progress = trackingProgress(item);
  const doneToday = hasDate(item.tracking_history);
  const streak = useMemo(
    () => computeStreak(item.tracking_history, item.streak_mode, item.weekly_frequency),
    [item.tracking_history, item.streak_mode, item.weekly_frequency],
  );

  return (
    <div className="space-y-2.5 border-t border-slate-100 px-3 py-3">
      <div className="flex items-center gap-3">
        <div className="relative grid h-12 w-12 place-items-center">
          <ProgressRing ratio={progress.ratio} size={48} color={color} className="absolute inset-0" />
          <span className="text-[10px] font-extrabold text-slate-700">{progress.done}</span>
        </div>
        <div className="min-w-0 flex-1 text-xs font-bold text-slate-500">
          <div>
            {progress.done}/{progress.target} ימים
          </div>
          <div>רצף {streak}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={doneToday ? () => unmarkToday(item.id) : () => markToday(item.id)}
          className={`flex h-11 items-center justify-center gap-1 rounded-xl text-xs font-extrabold ${
            doneToday ? "bg-slate-100 text-slate-600" : "bg-sky-500 text-white"
          }`}
        >
          <Check size={14} />
          {doneToday ? "לא בוצע" : "בוצע היום"}
        </button>
        <button
          type="button"
          onClick={() => minusDay(item.id)}
          className="h-11 rounded-xl bg-slate-50 text-xs font-bold text-slate-600"
        >
          החסר יום אחד
        </button>
      </div>
      <button
        type="button"
        onClick={() => setConfirmReset(true)}
        className="h-10 w-full rounded-xl bg-rose-50 text-xs font-bold text-rose-500"
      >
        איפוס מעקב
      </button>

      <div className="flex flex-wrap gap-1.5">
        {DAY_PRESETS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => updateBubble(item.id, { target_days: n })}
            className={`h-8 rounded-lg px-2.5 text-xs font-bold ${
              item.target_days === n ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-600"
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="לאפס את המעקב?"
        body="ההיסטוריה והרצף יימחקו."
        confirmLabel="איפוס"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          resetTracking(item.id);
          setConfirmReset(false);
        }}
      />
    </div>
  );
}

function ActionTools({ item }: { item: Bubble }) {
  const { updateBubble } = useApp();
  const [draft, setDraft] = useState("");

  const addStep = () => {
    const title = draft.trim();
    if (!title) return;
    updateBubble(item.id, {
      action_steps: [
        ...(item.action_steps ?? []),
        { id: `step-${crypto.randomUUID()}`, title, done: false },
      ],
    });
    setDraft("");
  };

  return (
    <div className="space-y-2.5 border-t border-slate-100 px-3 py-3">
      <label className="flex h-11 items-center gap-2 rounded-xl bg-slate-50 px-3">
        <input
          type="checkbox"
          checked={item.action_done}
          onChange={(e) => updateBubble(item.id, { action_done: e.target.checked })}
          className="h-4 w-4 accent-emerald-500"
        />
        <span className="text-xs font-extrabold text-slate-700">
          {item.action_done ? "בוצע" : "לסימון ביצוע"}
        </span>
      </label>

      <input
        type="date"
        value={item.due_at?.slice(0, 10) ?? ""}
        onChange={(e) =>
          updateBubble(item.id, {
            due_at: e.target.value || null,
            due_label: e.target.value ? dueText({ due_at: e.target.value, due_label: "" }) : "",
          })
        }
        className="h-11 w-full rounded-xl bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none"
      />
      <div className="flex flex-wrap gap-1.5">
        {WEEKDAYS.map((day) => (
          <button
            key={day.index}
            type="button"
            onClick={() => {
              const due_at = nextWeekdayIso(day.index);
              updateBubble(item.id, { due_at, due_label: `עד יום ${day.label}` });
            }}
            className="h-8 rounded-lg bg-slate-50 px-2 text-[11px] font-bold text-slate-600"
          >
            {day.label}
          </button>
        ))}
      </div>
      {dueText(item) && (
        <div className="text-[11px] font-bold text-emerald-600">{dueText(item)}</div>
      )}

      <div className="text-[11px] font-bold text-slate-400">תתי־צעדים</div>
      <div className="space-y-1">
        {(item.action_steps ?? []).map((step) => (
          <div key={step.id} className="flex h-10 items-center gap-2 rounded-xl bg-slate-50 px-2">
            <input
              type="checkbox"
              checked={step.done}
              onChange={(e) =>
                updateBubble(item.id, {
                  action_steps: (item.action_steps ?? []).map((row) =>
                    row.id === step.id ? { ...row, done: e.target.checked } : row,
                  ),
                })
              }
              className="h-4 w-4 accent-emerald-500"
            />
            <input
              value={step.title}
              onChange={(e) =>
                updateBubble(item.id, {
                  action_steps: (item.action_steps ?? []).map((row) =>
                    row.id === step.id ? { ...row, title: e.target.value } : row,
                  ),
                })
              }
              className="h-9 min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
            />
            <button
              type="button"
              onClick={() =>
                updateBubble(item.id, {
                  action_steps: (item.action_steps ?? []).filter((row) => row.id !== step.id),
                })
              }
              className="grid h-8 w-8 place-items-center text-rose-400"
              aria-label="מחיקת צעד"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
      <form
        className="flex h-10 items-center gap-2 rounded-xl bg-slate-50 px-2"
        onSubmit={(e) => {
          e.preventDefault();
          addStep();
        }}
      >
        <Plus size={14} className="text-slate-400" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="צעד חדש…"
          className="h-9 min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
        />
      </form>
    </div>
  );
}

function ThoughtTools({ item, spacious }: { item: Bubble; spacious: boolean }) {
  const { updateBubble } = useApp();
  return (
    <div className={`space-y-2 border-t border-slate-100 px-3 ${spacious ? "py-4" : "py-3"}`}>
      <div className="text-[11px] font-bold text-slate-400">תיאור והערות</div>
      <textarea
        value={item.notes}
        onChange={(e) => updateBubble(item.id, { notes: e.target.value })}
        rows={spacious ? 12 : 5}
        placeholder="רעיונות, מחקר ותובנות…"
        className={`w-full resize-none rounded-xl bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-700 outline-none ${
          spacious ? "min-h-[240px]" : ""
        }`}
      />
    </div>
  );
}

export function templateLabel(template: ToolTemplate): string {
  if (template === "action") return "תבנית משימה";
  if (template === "thought") return "תבנית מחשבה";
  return "תבנית מעקב";
}

export function TriangleSwatch({ type }: { type: TriangleType }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm font-extrabold" style={{ color: type.color }}>
      ▼ {type.name}
    </span>
  );
}

export function paletteButtons(
  selected: string,
  onPick: (color: string) => void,
) {
  return PALETTE.map((color) => (
    <button
      key={color}
      type="button"
      onClick={() => onPick(color)}
      className="h-7 w-7 rounded-full border-2"
      style={{
        background: color,
        borderColor: selected === color ? "#0f172a" : "transparent",
      }}
    />
  ));
}
