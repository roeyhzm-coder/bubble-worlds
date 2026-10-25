import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { accentFill, tint } from "../lib/accent";
import { todayKey } from "../lib/defaults";
import { MAX_DAILY, dateKey, dayProgress, type DayAction } from "../lib/tracking";
import { useApp } from "../state/AppProvider";
import type { Bubble } from "../types";

const HEB_DAYS = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"];
const MONTH_FORMAT = new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" });
const PARTIAL_COLOR = "#f59e0b";

/**
 * Month grid of check-ins; loaded lazily from the history drawer. Plain mode: tapping a past
 * day toggles it. Multi-daily mode: each day shows done/target, a tap selects it, a second tap
 * cycles its count, and steppers below adjust that day's count and target.
 */
export default function HistoryCalendar({
  item,
  color,
  multiDaily = false,
}: {
  item: Bubble;
  color: string;
  multiDaily?: boolean;
}) {
  const { toggleTrackingDate, applyDayAction } = useApp();
  const [offset, setOffset] = useState(0);
  const today = todayKey();
  const [selected, setSelected] = useState(today);
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
  const picked = dayProgress(item, selected);
  const act = (action: DayAction) => applyDayAction(item.id, selected, action);

  const onDay = (key: string) => {
    if (!multiDaily) {
      toggleTrackingDate(item.id, key);
      return;
    }
    if (key === selected) applyDayAction(item.id, key, "cycle");
    else setSelected(key);
  };

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
          const future = key > today;
          const day = multiDaily ? dayProgress(item, key) : null;
          const checked = day ? day.complete : done.has(key);
          const partial = Boolean(day && !day.complete && day.count > 0);
          const isSelected = multiDaily && key === selected;
          return (
            <button
              key={key}
              type="button"
              disabled={future}
              onClick={() => onDay(key)}
              className={`flex aspect-square flex-col items-center justify-center rounded-lg text-[11px] font-bold leading-none disabled:opacity-25 ${
                checked ? "text-white" : partial ? "text-amber-800" : "bg-slate-50 text-slate-600"
              } ${isSelected ? "ring-2 ring-slate-800" : key === today ? "ring-2 ring-slate-400" : ""}`}
              style={
                checked ? accentFill(color) : partial ? { background: tint(PARTIAL_COLOR, 22) } : undefined
              }
              aria-label={
                day
                  ? `${key} · ${day.count} מתוך ${day.target}${day.complete ? " · הושלם" : ""}`
                  : `${key} ${checked ? "בוצע" : "לא בוצע"}`
              }
              aria-pressed={multiDaily ? isSelected : checked}
            >
              <span>{Number(key.slice(8))}</span>
              {day && (day.count > 0 || key === selected) ? (
                <span className="mt-0.5 text-[8px] font-extrabold" dir="ltr">
                  {day.count}/{day.target}
                  {day.complete ? "✓" : ""}
                </span>
              ) : (
                checked && <span className="text-[9px]">✓</span>
              )}
            </button>
          );
        })}
      </div>
      {multiDaily ? (
        <div className="mt-2 space-y-1.5 rounded-xl p-2" style={{ background: tint(color, 8) }}>
          <div className="flex items-center justify-between gap-2 text-[11px] font-extrabold text-slate-600">
            <span>{selected === today ? "היום" : selected.split("-").reverse().join(".")}</span>
            <span
              className={`rounded-full px-1.5 py-0.5 ${picked.complete ? "text-white" : "text-slate-700"}`}
              style={picked.complete ? accentFill(color) : { background: tint(PARTIAL_COLOR, picked.count ? 22 : 0) }}
              dir="ltr"
            >
              {picked.count}/{picked.target}
              {picked.complete ? " ✓" : ""}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <DayStepper
              label="בוצע באותו יום"
              value={picked.count}
              min={0}
              color={color}
              onMinus={() => act("minus")}
              onPlus={() => act("plus")}
            />
            <DayStepper
              label="יעד לאותו יום"
              value={picked.target}
              min={1}
              color={color}
              onMinus={() => act("target_minus")}
              onPlus={() => act("target_plus")}
            />
          </div>
        </div>
      ) : null}
      <div className="mt-1.5 text-center text-[10px] font-bold text-slate-400">
        {multiDaily
          ? "לחיצה בוחרת יום · לחיצה נוספת מעלה את הספירה (ואחרי היעד מאפסת)"
          : "לחיצה על יום מסמנת או מבטלת ביצוע"}
      </div>
    </div>
  );
}

function DayStepper({
  label,
  value,
  min,
  color,
  onMinus,
  onPlus,
}: {
  label: string;
  value: number;
  min: number;
  color: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-white px-1.5 py-1 ring-1 ring-slate-200">
      <div className="truncate text-center text-[10px] font-extrabold text-slate-500">{label}</div>
      <div className="flex h-8 items-center justify-between">
        <button
          type="button"
          onClick={onMinus}
          disabled={value <= min}
          className="grid h-8 w-8 place-items-center rounded-lg bg-slate-50 text-sm font-black text-slate-600 disabled:opacity-30"
          aria-label={`הפחתת ${label}`}
        >
          −
        </button>
        <span className="text-sm font-black" style={{ color }} aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          onClick={onPlus}
          disabled={value >= MAX_DAILY}
          className="grid h-8 w-8 place-items-center rounded-lg bg-slate-50 text-sm font-black text-slate-600 disabled:opacity-30"
          aria-label={`הגדלת ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}
