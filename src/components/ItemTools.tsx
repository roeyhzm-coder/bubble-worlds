import { Check, ChevronLeft, ChevronRight, Plus, StickyNote, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { PALETTE, todayKey } from "../lib/defaults";
import {
  computeStreak,
  dateKey,
  hasDate,
  isItemCompleted,
  itemStreak,
  trackingProgress,
  weeklyProgress,
} from "../lib/tracking";
import { WEEKDAYS, dueText, findTriangle, nextWeekdayIso } from "../lib/triangles";
import { useApp } from "../state/AppProvider";
import type { Bubble, ToolTemplate, TriangleType } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";
import { ProgressRing } from "./ProgressRing";

const DAY_PRESETS = [21, 30, 60, 90, 120];
const FREQUENCIES = [1, 2, 3, 4, 5, 6, 7];
const HEB_DAYS = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"];
const MONTH_FORMAT = new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" });

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
  onChange: (id: string | null) => void;
}) {
  const { snapshot } = useApp();
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-extrabold ${
          !value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
        }`}
      >
        ∅ ללא
      </button>
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

/** Small header marker shown on collapsed rows whose notes are filled in. */
export function NoteIndicator({ notes }: { notes: string }) {
  if (!notes?.trim()) return null;
  return (
    <StickyNote size={13} className="shrink-0 text-amber-400" aria-label="יש הערות" />
  );
}

export function NotesField({ item, rows = 3 }: { item: Bubble; rows?: number }) {
  const { updateBubble } = useApp();
  return (
    <div className="space-y-1.5 border-t border-slate-100 px-3 py-3">
      <div className="text-[11px] font-bold text-slate-400">הערות והסכם אישי</div>
      <textarea
        value={item.notes}
        onChange={(e) => updateBubble(item.id, { notes: e.target.value })}
        rows={rows}
        placeholder="כתוב כאן פירוט, כללים, או מה ההסכם כולל..."
        className="w-full resize-none rounded-xl bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-700 outline-none"
      />
    </div>
  );
}

/** Celebratory bar shown once an item reaches its goal: archive to the vault or delete. */
export function CompletionBar({ item, onDelete }: { item: Bubble; onDelete: () => void }) {
  const { snapshot, archiveBubbleAsSuccess } = useApp();
  const [busy, setBusy] = useState(false);
  const type = findTriangle(snapshot.triangleTypes, item.triangle_id);
  if (!isItemCompleted(item, type?.template)) return null;
  return (
    <div className="mx-2 mb-2 rounded-xl border border-amber-200 bg-amber-50 p-2">
      <div className="mb-1.5 text-center text-[12px] font-extrabold text-amber-800">
        🎉 האתגר הושלם!
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation();
            if (busy) return;
            setBusy(true);
            archiveBubbleAsSuccess(item.id);
          }}
          className="h-11 rounded-xl bg-amber-400 text-xs font-extrabold text-white shadow-soft disabled:opacity-60"
        >
          🏆 שמור בהצלחות
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="h-11 rounded-xl bg-white text-xs font-extrabold text-rose-500 shadow-soft"
        >
          🗑️ מחק פריט
        </button>
      </div>
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
  if (!type) return null;
  if (type.template === "thought") return <ThoughtTools item={live} spacious={spacious} />;
  return (
    <>
      {type.template === "action" ? (
        <ActionTools item={live} />
      ) : (
        <TrackingTools item={live} color={type.color} />
      )}
      <NotesField item={live} />
    </>
  );
}

function CompleteToggle({ item, label }: { item: Bubble; label: string }) {
  const { updateBubble } = useApp();
  const on = Boolean(item.challenge_done);
  return (
    <button
      type="button"
      onClick={() => updateBubble(item.id, { challenge_done: !on })}
      className={`flex h-11 w-full items-center justify-center gap-1 rounded-xl text-xs font-extrabold ${
        on ? "bg-emerald-500 text-white" : "bg-emerald-50 text-emerald-700"
      }`}
    >
      {on ? `✓ ${label.replace(/\s*✓$/, "")} · בטל` : label}
    </button>
  );
}

function NumberField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (next: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    setDraft(String(value));
  }, [value]);
  return (
    <label className="flex h-11 items-center gap-2 rounded-xl bg-slate-50 px-3">
      <span className="shrink-0 text-[11px] font-extrabold text-slate-500">{label}</span>
      <input
        type="number"
        min={0}
        max={3650}
        inputMode="numeric"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          const next = Math.round(Number(e.target.value));
          if (e.target.value === "" || !Number.isFinite(next) || next < 0) return;
          onCommit(Math.min(3650, next));
        }}
        className="h-10 min-w-0 flex-1 bg-transparent text-end text-sm font-extrabold text-slate-800 outline-none"
        aria-label={label}
      />
    </label>
  );
}

function HistoryCalendar({ item, color }: { item: Bubble; color: string }) {
  const { toggleTrackingDate } = useApp();
  const [offset, setOffset] = useState(0);
  const today = todayKey();
  const done = useMemo(() => new Set(item.tracking_history ?? []), [item.tracking_history]);
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: first.getDay() }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      dateKey(new Date(first.getFullYear(), first.getMonth(), i + 1)),
    ),
  ];
  const monthDone = cells.filter((key) => key && done.has(key)).length;

  return (
    <div className="rounded-xl bg-slate-50 p-2">
      <div className="mb-1.5 flex h-9 items-center justify-between">
        <button
          type="button"
          onClick={() => setOffset((n) => Math.min(36, n + 1))}
          className="grid h-9 w-9 place-items-center rounded-lg text-slate-500"
          aria-label="חודש קודם"
        >
          <ChevronRight size={16} />
        </button>
        <div className="text-center text-xs font-extrabold text-slate-700">
          {MONTH_FORMAT.format(first)}
          <span className="ms-1 text-[10px] font-bold text-slate-400">· {monthDone} ימים</span>
        </div>
        <button
          type="button"
          disabled={offset === 0}
          onClick={() => setOffset((n) => Math.max(0, n - 1))}
          className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 disabled:opacity-30"
          aria-label="חודש הבא"
        >
          <ChevronLeft size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {HEB_DAYS.map((label) => (
          <div key={label} className="text-center text-[10px] font-extrabold text-slate-400">
            {label}
          </div>
        ))}
        {cells.map((key, index) => {
          if (!key) return <div key={`blank-${index}`} />;
          const checked = done.has(key);
          const future = key > today;
          return (
            <button
              key={key}
              type="button"
              disabled={future}
              onClick={() => toggleTrackingDate(item.id, key)}
              className={`flex aspect-square flex-col items-center justify-center rounded-lg text-[11px] font-bold leading-none disabled:opacity-25 ${
                checked ? "text-white" : "bg-white text-slate-600"
              } ${key === today ? "ring-2 ring-slate-400" : ""}`}
              style={checked ? { background: color } : undefined}
              aria-label={`${key} ${checked ? "בוצע" : "לא בוצע"}`}
              aria-pressed={checked}
            >
              <span>{Number(key.slice(8))}</span>
              {checked && <span className="text-[9px]">✓</span>}
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 text-center text-[10px] font-bold text-slate-400">
        לחיצה על יום מסמנת או מבטלת ביצוע
      </div>
    </div>
  );
}

function TrackingTools({ item, color }: { item: Bubble; color: string }) {
  const { updateBubble, markToday, unmarkToday, minusDay, resetTracking } = useApp();
  const [confirmReset, setConfirmReset] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [customDays, setCustomDays] = useState(String(item.target_days || 30));

  useEffect(() => {
    setCustomDays(String(item.target_days || 30));
  }, [item.target_days]);

  const applyCustomDays = (raw: string) => {
    setCustomDays(raw);
    const next = Math.round(Number(raw));
    if (!Number.isFinite(next) || next < 1) return;
    updateBubble(item.id, { target_days: Math.min(3650, next) });
  };
  const progress = trackingProgress(item);
  const doneToday = hasDate(item.tracking_history);
  const frequency = Math.min(7, Math.max(1, item.weekly_frequency || 7));
  const week = weeklyProgress(item);
  const streak = itemStreak(item);
  const baseStreak = useMemo(
    () => computeStreak(item.tracking_history, item.streak_mode, item.weekly_frequency),
    [item.tracking_history, item.streak_mode, item.weekly_frequency],
  );
  const loggedDays = new Set(item.tracking_history ?? []).size;

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
        {frequency < 7 && (
          <span
            className={`shrink-0 rounded-lg px-2 py-1 text-[11px] font-extrabold ${
              week.done >= week.target ? "bg-emerald-100 text-emerald-700" : "bg-sky-50 text-sky-700"
            }`}
          >
            השבוע: {week.done}/{week.target} בוצעו
          </span>
        )}
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
        onClick={() => setShowHistory((v) => !v)}
        aria-expanded={showHistory}
        className={`h-11 w-full rounded-xl text-xs font-extrabold ${
          showHistory ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-700"
        }`}
      >
        📅 היסטוריית מעקב ועריכת נתונים
      </button>
      {showHistory && (
        <div className="space-y-1.5">
          <HistoryCalendar item={item} color={color} />
          <NumberField
            label="ימים שהושלמו"
            value={progress.done}
            onCommit={(next) => updateBubble(item.id, { done_offset: next - loggedDays })}
          />
          <NumberField
            label="רצף נוכחי"
            value={streak}
            onCommit={(next) => updateBubble(item.id, { streak_offset: next - baseStreak })}
          />
        </div>
      )}

      <div className="text-[11px] font-bold text-slate-400">יעד ימים</div>
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
      <label className="flex h-11 items-center gap-2 rounded-xl bg-slate-50 px-3">
        <span className="shrink-0 text-[11px] font-extrabold text-slate-500">ימים מותאמים אישית</span>
        <input
          type="number"
          min={1}
          max={3650}
          inputMode="numeric"
          value={customDays}
          onChange={(e) => applyCustomDays(e.target.value)}
          className="h-10 min-w-0 flex-1 bg-transparent text-end text-sm font-extrabold text-slate-800 outline-none"
          aria-label="ימים מותאמים אישית"
        />
      </label>

      <div className="text-[11px] font-bold text-slate-400">תדירות שבועית מותאמת אישית</div>
      <div className="flex flex-wrap gap-1.5">
        {FREQUENCIES.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => updateBubble(item.id, { weekly_frequency: n })}
            className={`h-8 rounded-lg px-2.5 text-xs font-bold ${
              frequency === n ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-600"
            }`}
          >
            {n === 7 ? "כל השבוע (7)" : n}
          </button>
        ))}
      </div>

      <CompleteToggle item={item} label="סיימתי את האתגר ✓" />

      <button
        type="button"
        onClick={() => setConfirmReset(true)}
        className="h-10 w-full rounded-xl bg-rose-50 text-xs font-bold text-rose-500"
      >
        איפוס מעקב
      </button>

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
      <div className="text-[11px] font-bold text-slate-400">הערות והסכם אישי</div>
      <textarea
        value={item.notes}
        onChange={(e) => updateBubble(item.id, { notes: e.target.value })}
        rows={spacious ? 12 : 5}
        placeholder="כתוב כאן פירוט, כללים, או מה ההסכם כולל..."
        className={`w-full resize-none rounded-xl bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-700 outline-none ${
          spacious ? "min-h-[240px]" : ""
        }`}
      />
      <CompleteToggle item={item} label="סיים והשלם" />
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
