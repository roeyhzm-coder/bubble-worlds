import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { accentFill } from "../lib/accent";
import { todayKey } from "../lib/defaults";
import { dateKey } from "../lib/tracking";
import { useApp } from "../state/AppProvider";
import type { Bubble } from "../types";

const HEB_DAYS = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"];
const MONTH_FORMAT = new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" });

/** Month grid of check-ins; tapping a past day toggles it. Loaded lazily from the history drawer. */
export default function HistoryCalendar({ item, color }: { item: Bubble; color: string }) {
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
