import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Plus, StickyNote, Trash2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import { PALETTE, todayKey } from "../lib/defaults";
import {
  computeStreak,
  dateKey,
  hasDate,
  isItemCompleted,
  itemStreak,
  logSessionOutcome,
  sessionOpportunities,
  sessionProgress,
  trackingProgress,
  weeklyProgress,
} from "../lib/tracking";
import { WEEKDAYS, dueText, findTriangle, nextWeekdayIso } from "../lib/triangles";
import { useApp } from "../state/AppProvider";
import type { Bubble, ToolTemplate, TriangleType } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";
import { ProgressRing } from "./ProgressRing";

const DAY_PRESETS = [21, 30, 60, 90, 120];
const SESSION_PRESETS = [10, 25, 50, 100];
const COUNTER_COLOR = "#7C3AED";
const FREQUENCIES = [1, 2, 3, 4, 5, 6, 7];
const HEB_DAYS = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"];
const MONTH_FORMAT = new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" });
const SAVED_FLASH_MS = 1800;

/** Rich gradient fill + inner highlight + colored drop shadow for a primary action. */
export function accentFill(color: string): CSSProperties {
  return {
    background: `linear-gradient(135deg, ${color} 0%, color-mix(in srgb, ${color} 72%, #0f172a) 100%)`,
    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.28), 0 8px 18px -8px color-mix(in srgb, ${color} 80%, transparent)`,
  };
}

/** Anchoring ring for an expanded card, tinted with its triangle color. */
export function accentRing(color: string): CSSProperties {
  return {
    borderColor: `color-mix(in srgb, ${color} 55%, transparent)`,
    borderInlineStartWidth: 4,
    borderInlineStartColor: color,
    boxShadow: `0 0 0 1px color-mix(in srgb, ${color} 30%, transparent), 0 12px 28px -14px color-mix(in srgb, ${color} 70%, transparent)`,
  };
}

function tint(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, white)`;
}

/** Shows a transient "saved" flag after each edit, so typing always gets visible confirmation. */
export function useSavedFlash(): { saved: boolean; flash: () => void } {
  const [saved, setSaved] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );
  const flash = useCallback(() => {
    setSaved(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setSaved(false), SAVED_FLASH_MS);
  }, []);
  return { saved, flash };
}

export function SavedBadge({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.span
          initial={{ opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-600"
          role="status"
        >
          נשמר אוטומטית ✓
        </motion.span>
      )}
    </AnimatePresence>
  );
}

/** Smooth height-animated drawer used for progressive disclosure. */
function Drawer({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          className="overflow-hidden"
        >
          <div className="pt-1">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Chip({
  active,
  color,
  onClick,
  children,
  danger = false,
}: {
  active: boolean;
  color: string;
  onClick: () => void;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={danger ? undefined : active}
      className={`chip ${
        danger
          ? "border-rose-200 bg-white text-rose-500 hover:bg-rose-50"
          : active
            ? "text-slate-900"
            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
      style={active && !danger ? { background: tint(color, 14), borderColor: tint(color, 55) } : undefined}
    >
      {children}
    </button>
  );
}

function PresetButton({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean;
  color: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-8 rounded-lg px-2.5 text-xs font-bold ${
        active ? "text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
      }`}
      style={active ? accentFill(color) : undefined}
    >
      {children}
    </button>
  );
}

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
            value === type.id ? "text-white" : "bg-slate-100 text-slate-600"
          }`}
          style={value === type.id ? accentFill(type.color) : undefined}
        >
          <span style={{ color: value === type.id ? "#fff" : type.color }}>▼</span>
          {type.name}
        </button>
      ))}
    </div>
  );
}

/** Compact pill showing the current triangle type; opens the full picker inline on demand. */
export function TypeSwitcher({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const { snapshot } = useApp();
  const [open, setOpen] = useState(false);
  const type = findTriangle(snapshot.triangleTypes, value);
  const color = type?.color ?? "#94a3b8";
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="chip text-slate-700"
        style={{ background: tint(color, 12), borderColor: tint(color, 45) }}
      >
        <span style={{ color }}>{type ? "▼" : "∅"}</span>
        {type?.name ?? "ללא משולש"}
        <ChevronDown
          size={13}
          className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <Drawer open={open}>
        <div className="rounded-xl bg-slate-50 p-2">
          <TrianglePicker
            value={value}
            onChange={(id) => {
              onChange(id);
              setOpen(false);
            }}
          />
        </div>
      </Drawer>
    </div>
  );
}

/** One-tap progress control for collapsed rows: check-in today, +1 session, or task done. */
export function QuickCheck({
  item,
  type,
  size = 40,
}: {
  item: Bubble;
  type: TriangleType;
  size?: number;
}) {
  const { updateBubble, markToday, unmarkToday } = useApp();
  const [pulse, setPulse] = useState(0);
  const template = type.template;

  if (template === "thought") {
    return (
      <span className="grid shrink-0 place-items-center text-lg" style={{ color: type.color, width: size }}>
        ▼
      </span>
    );
  }

  const doneToday = template === "tracking" && hasDate(item.tracking_history);
  const progress = template === "counter" ? sessionProgress(item) : trackingProgress(item);
  const label =
    template === "tracking"
      ? doneToday
        ? "בטל את הסימון של היום"
        : "סמן בוצע היום"
      : template === "counter"
        ? "ביצעתי הפעם (+1)"
        : item.action_done
          ? "בטל ביצוע"
          : "סמן כבוצע";

  const onTap = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (template === "tracking") {
      if (doneToday) unmarkToday(item.id);
      else markToday(item.id);
    } else if (template === "counter") {
      updateBubble(item.id, logSessionOutcome(item, "done"));
    } else {
      updateBubble(item.id, { action_done: !item.action_done });
    }
    setPulse((n) => n + 1);
  };

  return (
    <motion.button
      type="button"
      onClick={onTap}
      whileTap={{ scale: 0.86 }}
      aria-label={label}
      title={label}
      aria-pressed={template === "counter" ? undefined : template === "tracking" ? doneToday : item.action_done}
      className="relative grid shrink-0 place-items-center"
      style={{ width: size + 4, height: size + 4 }}
    >
      <motion.span
        key={pulse}
        initial={pulse ? { scale: 0.82 } : false}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 520, damping: 14 }}
        className="relative grid place-items-center"
        style={{ width: size, height: size }}
      >
        {template === "action" ? (
          <span
            className={`grid h-7 w-7 place-items-center rounded-lg border-2 text-sm font-black ${
              item.action_done ? "border-transparent text-white" : "border-slate-300 bg-white"
            }`}
            style={item.action_done ? accentFill("#10b981") : undefined}
          >
            {item.action_done ? "✓" : ""}
          </span>
        ) : (
          <>
            <ProgressRing ratio={progress.ratio} size={size} color={type.color} className="absolute inset-0" />
            {doneToday ? (
              <span
                className="grid place-items-center rounded-full text-white"
                style={{ ...accentFill(type.color), width: size - 12, height: size - 12 }}
              >
                <Check size={Math.round(size / 3)} strokeWidth={3} />
              </span>
            ) : (
              <span className="text-[10px] font-extrabold text-slate-600">{progress.done}</span>
            )}
          </>
        )}
      </motion.span>
      <AnimatePresence>
        {pulse > 0 && template === "counter" && (
          <motion.span
            key={pulse}
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 0, y: -18 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7 }}
            className="pointer-events-none absolute -top-1 text-[11px] font-black"
            style={{ color: type.color }}
          >
            +1
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

/** Small header marker shown on collapsed rows whose notes are filled in. */
export function NoteIndicator({ notes }: { notes: string }) {
  if (!notes?.trim()) return null;
  return (
    <StickyNote size={13} className="shrink-0 text-amber-400" aria-label="יש הערות" />
  );
}

/** Inline title editor for an expanded card, with auto-save confirmation. */
export function TitleField({ item }: { item: Bubble }) {
  const { updateBubble } = useApp();
  const { saved, flash } = useSavedFlash();
  return (
    <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-200/70 bg-slate-50/80 px-3 focus-within:border-transparent focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-200">
      <input
        value={item.title}
        onChange={(e) => {
          updateBubble(item.id, { title: e.target.value });
          flash();
        }}
        placeholder="שם הפריט"
        aria-label="שם הפריט"
        className="h-9 min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none"
      />
      <SavedBadge visible={saved} />
    </div>
  );
}

/** Explicit close affordance for an expanded card; edits are already saved live. */
export function DoneEditingButton({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex justify-end px-3 pb-3">
      <button
        type="button"
        onClick={onDone}
        className="inline-flex h-8 items-center gap-1 rounded-full bg-slate-900 px-3 text-[11px] font-extrabold text-white shadow-sm"
      >
        <Check size={13} />
        סיום עריכה
      </button>
    </div>
  );
}

export function NotesField({ item, minRows = 2 }: { item: Bubble; minRows?: number }) {
  const { updateBubble } = useApp();
  const { saved, flash } = useSavedFlash();
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [item.notes]);

  return (
    <div className="px-3 py-2">
      <div className="rounded-xl border border-slate-200/60 bg-slate-50/80 px-3 py-2 transition-colors focus-within:border-transparent focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-200">
        <div className="mb-0.5 flex h-5 items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-slate-400">📝 הערות והסכם אישי</span>
          <SavedBadge visible={saved} />
        </div>
        <textarea
          ref={ref}
          value={item.notes}
          onChange={(e) => {
            updateBubble(item.id, { notes: e.target.value });
            flash();
          }}
          rows={minRows}
          placeholder="כתוב כאן פירוט, כללים, או מה ההסכם כולל..."
          className="block w-full resize-none overflow-hidden bg-transparent text-sm leading-relaxed text-slate-700 outline-none placeholder:text-slate-400"
        />
      </div>
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
    <div className="mx-2 mb-2 rounded-xl border border-amber-200 bg-gradient-to-b from-amber-50 to-amber-100/60 p-2">
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
          className="h-10 rounded-xl text-xs font-extrabold text-white disabled:opacity-60"
          style={accentFill("#f59e0b")}
        >
          🏆 שמור בהצלחות
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="h-10 rounded-xl bg-white text-xs font-extrabold text-rose-500 shadow-sm ring-1 ring-rose-100"
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
      ) : type.template === "counter" ? (
        <CounterTools item={live} color={type.color} />
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
      className={`flex h-9 w-full items-center justify-center gap-1 rounded-xl text-[11px] font-extrabold ${
        on
          ? "bg-emerald-500 text-white shadow-sm"
          : "border border-dashed border-emerald-300 bg-emerald-50/50 text-emerald-700"
      }`}
    >
      {on ? `✓ ${label.replace(/^\s*✓\s*|\s*✓$/g, "")} · בטל` : label}
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
    <label className="flex h-10 items-center gap-2 rounded-xl bg-white px-3 ring-1 ring-slate-200">
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
        className="h-9 min-w-0 flex-1 bg-transparent text-end text-sm font-extrabold text-slate-800 outline-none"
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
    <div className="rounded-xl bg-white p-2 ring-1 ring-slate-200">
      <div className="mb-1.5 flex h-9 items-center justify-between">
        <button
          type="button"
          onClick={() => setOffset((n) => Math.min(36, n + 1))}
          className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-50"
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
          className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-50 disabled:opacity-30"
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
                checked ? "text-white" : "bg-slate-50 text-slate-600"
              } ${key === today ? "ring-2 ring-slate-400" : ""}`}
              style={checked ? accentFill(color) : undefined}
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

type TrackingPanel = "target" | "frequency" | "history" | null;

function TrackingTools({ item, color }: { item: Bubble; color: string }) {
  const { updateBubble, markToday, unmarkToday, minusDay, resetTracking } = useApp();
  const [confirmReset, setConfirmReset] = useState(false);
  const [panel, setPanel] = useState<TrackingPanel>(null);
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
  const togglePanel = (next: Exclude<TrackingPanel, null>) =>
    setPanel((current) => (current === next ? null : next));

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
    <div className="space-y-2 border-t border-slate-100 px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <div className="relative grid h-11 w-11 shrink-0 place-items-center">
          <ProgressRing ratio={progress.ratio} size={44} color={color} className="absolute inset-0" />
          <span className="text-[10px] font-extrabold text-slate-700">{progress.done}</span>
        </div>
        <div className="min-w-0 flex-1 text-[12px] font-bold leading-tight text-slate-500">
          <div className="text-slate-800">
            {progress.done}/{progress.target} ימים
          </div>
          <div>🔥 רצף {streak}</div>
        </div>
        {frequency < 7 && (
          <span
            className={`shrink-0 rounded-lg px-2 py-1 text-[11px] font-extrabold ${
              week.done >= week.target ? "bg-emerald-100 text-emerald-700" : "bg-sky-50 text-sky-700"
            }`}
          >
            השבוע: {week.done}/{week.target}
          </span>
        )}
      </div>

      <div className="grid grid-cols-[7fr_3fr] gap-1.5">
        <button
          type="button"
          onClick={doneToday ? () => unmarkToday(item.id) : () => markToday(item.id)}
          className={`flex h-11 items-center justify-center gap-1 rounded-xl text-[13px] font-extrabold ${
            doneToday ? "text-slate-700 ring-1" : "text-white"
          }`}
          style={
            doneToday
              ? { background: tint(color, 14), ["--tw-ring-color" as string]: tint(color, 50) }
              : accentFill(color)
          }
        >
          <Check size={15} strokeWidth={3} />
          {doneToday ? "בוצע היום · בטל" : "בוצע היום"}
        </button>
        <button
          type="button"
          onClick={() => minusDay(item.id)}
          className="h-11 rounded-xl bg-white text-[12px] font-extrabold text-slate-600 ring-1 ring-slate-200"
        >
          -1 החסר
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Chip active={panel === "target"} color={color} onClick={() => togglePanel("target")}>
          🎯 יעד: {progress.target} ימים
        </Chip>
        <Chip active={panel === "frequency"} color={color} onClick={() => togglePanel("frequency")}>
          ⚡ תדירות: {frequency === 7 ? "כל יום" : `${frequency} בשבוע`}
        </Chip>
        <Chip active={panel === "history"} color={color} onClick={() => togglePanel("history")}>
          📅 היסטוריה
        </Chip>
        <Chip active={false} color={color} danger onClick={() => setConfirmReset(true)}>
          🔄 איפוס
        </Chip>
      </div>

      <Drawer open={panel === "target"}>
        <div className="space-y-1.5 rounded-xl bg-slate-50 p-2">
          <div className="flex flex-wrap gap-1.5">
            {DAY_PRESETS.map((n) => (
              <PresetButton
                key={n}
                active={item.target_days === n}
                color={color}
                onClick={() => updateBubble(item.id, { target_days: n })}
              >
                {n}
              </PresetButton>
            ))}
          </div>
          <label className="flex h-10 items-center gap-2 rounded-xl bg-white px-3 ring-1 ring-slate-200">
            <span className="shrink-0 text-[11px] font-extrabold text-slate-500">ימים מותאמים אישית</span>
            <input
              type="number"
              min={1}
              max={3650}
              inputMode="numeric"
              value={customDays}
              onChange={(e) => applyCustomDays(e.target.value)}
              className="h-9 min-w-0 flex-1 bg-transparent text-end text-sm font-extrabold text-slate-800 outline-none"
              aria-label="ימים מותאמים אישית"
            />
          </label>
        </div>
      </Drawer>

      <Drawer open={panel === "frequency"}>
        <div className="space-y-1.5 rounded-xl bg-slate-50 p-2">
          <div className="text-[11px] font-bold text-slate-400">כמה פעמים בשבוע?</div>
          <div className="flex flex-wrap gap-1.5">
            {FREQUENCIES.map((n) => (
              <PresetButton
                key={n}
                active={frequency === n}
                color={color}
                onClick={() => updateBubble(item.id, { weekly_frequency: n })}
              >
                {n === 7 ? "כל יום" : n}
              </PresetButton>
            ))}
          </div>
        </div>
      </Drawer>

      <Drawer open={panel === "history"}>
        <div className="space-y-1.5 rounded-xl bg-slate-50 p-2">
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
      </Drawer>

      <CompleteToggle item={item} label="סיימתי את האתגר ✓" />

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

/** Compact X/Y ring for collapsed counter rows. */
export function SessionBadge({ item, color, size = 40 }: { item: Bubble; color: string; size?: number }) {
  const progress = sessionProgress(item);
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <ProgressRing ratio={progress.ratio} size={size} color={color} className="absolute inset-0" />
      <span className="text-[9px] font-extrabold text-slate-600">{progress.done}</span>
    </div>
  );
}

/** Stacked label + numeric input that fits two-per-row in the counter panel. */
function CompactNumberField({
  label,
  value,
  min,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  onCommit: (next: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    setDraft(String(value));
  }, [value]);
  return (
    <label className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-white px-2.5 py-1.5 ring-1 ring-violet-100">
      <span className="truncate text-[10px] font-extrabold text-violet-700/80">{label}</span>
      <input
        type="number"
        min={min}
        max={100000}
        inputMode="numeric"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          const next = Math.round(Number(e.target.value));
          if (e.target.value === "" || !Number.isFinite(next) || next < min) return;
          onCommit(Math.min(100000, next));
        }}
        className="h-8 w-full min-w-0 bg-transparent text-end text-base font-extrabold text-slate-800 outline-none"
        aria-label={label}
      />
    </label>
  );
}

type CounterPanel = "target" | "count" | null;

/** Purple opportunity tracker: counts taken chances toward a goal, no dates or streaks. */
function CounterTools({ item, color }: { item: Bubble; color: string }) {
  const { updateBubble } = useApp();
  const [confirmReset, setConfirmReset] = useState(false);
  const [panel, setPanel] = useState<CounterPanel>(null);
  const progress = sessionProgress(item);
  const odds = sessionOpportunities(item);
  const ringColor = color || COUNTER_COLOR;

  const setCount = (next: number) =>
    updateBubble(item.id, { session_count: Math.min(100000, Math.max(0, Math.round(next))) });
  const togglePanel = (next: Exclude<CounterPanel, null>) =>
    setPanel((current) => (current === next ? null : next));

  return (
    <div className="space-y-2 border-t border-violet-100 px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <div className="relative grid h-12 w-12 shrink-0 place-items-center">
          <ProgressRing ratio={progress.ratio} size={48} color={ringColor} className="absolute inset-0" />
          <span className="text-[13px] font-extrabold" style={{ color: COUNTER_COLOR }}>
            {progress.done}
          </span>
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-[14px] font-extrabold text-slate-800">
            {progress.done} / {progress.target} פעמים
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-lg bg-violet-50 px-2 py-0.5 text-[11px] font-extrabold text-violet-700">
              {odds.total > 0
                ? `${odds.taken}/${odds.total} הזדמנויות · ${odds.accuracy}%`
                : "עוד לא נרשמו יציאות"}
            </span>
            {odds.recent.length > 0 && (
              <div className="flex gap-1" aria-label="10 היציאות האחרונות">
                {odds.recent.map((outcome, index) => (
                  <span
                    key={index}
                    className={`h-2 w-2 rounded-full ${
                      outcome === "done" ? "" : "border border-slate-300 bg-white"
                    }`}
                    style={outcome === "done" ? { background: COUNTER_COLOR } : undefined}
                    title={outcome === "done" ? "ביצעתי" : "לא ביצעתי"}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[7fr_3fr] gap-1.5">
        <button
          type="button"
          onClick={() => updateBubble(item.id, logSessionOutcome(item, "done"))}
          className="flex h-11 items-center justify-center gap-1 rounded-xl text-[13px] font-extrabold text-white"
          style={accentFill(ringColor)}
        >
          ✓ ביצעתי הפעם (+1)
        </button>
        <button
          type="button"
          onClick={() => updateBubble(item.id, logSessionOutcome(item, "missed"))}
          className="h-11 rounded-xl bg-white text-[12px] font-extrabold text-rose-600 ring-1 ring-rose-200"
        >
          -1 החסר
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Chip active={panel === "target"} color={ringColor} onClick={() => togglePanel("target")}>
          🎯 יעד: {progress.target} פעמים
        </Chip>
        <Chip active={panel === "count"} color={ringColor} onClick={() => togglePanel("count")}>
          ✏️ עריכת מונה
        </Chip>
        <Chip active={false} color={ringColor} danger onClick={() => setConfirmReset(true)}>
          🔄 איפוס
        </Chip>
      </div>

      <Drawer open={panel === "target"}>
        <div className="space-y-1.5 rounded-xl bg-violet-50/50 p-2">
          <div className="flex flex-wrap gap-1.5">
            {SESSION_PRESETS.map((n) => (
              <PresetButton
                key={n}
                active={progress.target === n}
                color={ringColor}
                onClick={() => updateBubble(item.id, { session_target: n })}
              >
                {n} פעמים
              </PresetButton>
            ))}
          </div>
          <CompactNumberField
            label="יעד מותאם אישית"
            value={progress.target}
            min={1}
            onCommit={(next) => updateBubble(item.id, { session_target: next })}
          />
        </div>
      </Drawer>

      <Drawer open={panel === "count"}>
        <div className="rounded-xl bg-violet-50/50 p-2">
          <CompactNumberField label="עריכת מונה נוכחי" value={progress.done} min={0} onCommit={setCount} />
        </div>
      </Drawer>

      <CompleteToggle item={item} label="✓ סיימתי את האתגר" />

      <ConfirmDialog
        open={confirmReset}
        title="לאפס את המונה?"
        body="הספירה וההיסטוריה של היציאות יתאפסו. היעד וההערות נשמרים."
        confirmLabel="איפוס"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          updateBubble(item.id, {
            session_count: 0,
            session_taken: 0,
            session_missed: 0,
            session_log: [],
          });
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
    <div className="space-y-2 border-t border-slate-100 px-3 py-2.5">
      <button
        type="button"
        onClick={() => updateBubble(item.id, { action_done: !item.action_done })}
        aria-pressed={item.action_done}
        className={`flex h-11 w-full items-center justify-center gap-1 rounded-xl text-[13px] font-extrabold ${
          item.action_done ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "text-white"
        }`}
        style={item.action_done ? undefined : accentFill("#10b981")}
      >
        <Check size={15} strokeWidth={3} />
        {item.action_done ? "בוצע · בטל" : "סמן כבוצע"}
      </button>

      <input
        type="date"
        value={item.due_at?.slice(0, 10) ?? ""}
        onChange={(e) =>
          updateBubble(item.id, {
            due_at: e.target.value || null,
            due_label: e.target.value ? dueText({ due_at: e.target.value, due_label: "" }) : "",
          })
        }
        className="h-10 w-full rounded-xl bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none"
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
            className="h-8 rounded-lg bg-slate-50 px-2 text-[11px] font-bold text-slate-600 hover:bg-slate-100"
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
        className="flex h-10 items-center gap-2 rounded-xl bg-slate-50 ps-2 pe-1"
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
        <button
          type="submit"
          disabled={!draft.trim()}
          className="h-8 shrink-0 rounded-lg bg-emerald-500 px-2.5 text-[11px] font-extrabold text-white disabled:bg-slate-200 disabled:text-slate-400"
        >
          הוסף +
        </button>
      </form>
    </div>
  );
}

function ThoughtTools({ item, spacious }: { item: Bubble; spacious: boolean }) {
  return (
    <div className={`space-y-2 border-t border-slate-100 ${spacious ? "pb-3 pt-1" : "pb-2.5"}`}>
      <NotesField item={item} minRows={spacious ? 8 : 4} />
      <div className="px-3">
        <CompleteToggle item={item} label="סיים והשלם" />
      </div>
    </div>
  );
}

export function templateLabel(template: ToolTemplate): string {
  if (template === "action") return "תבנית משימה";
  if (template === "thought") return "תבנית מחשבה";
  if (template === "counter") return "מונה פעמים / הזדמנויות";
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
