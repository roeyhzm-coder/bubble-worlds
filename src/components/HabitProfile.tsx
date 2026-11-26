import { ChevronDown, Target } from "lucide-react";
import { useEffect, useState } from "react";
import { accentFill } from "../lib/accent";
import { todayKey } from "../lib/defaults";
import { supportsWeeklyTarget } from "../lib/habitReport";
import { NO_TOPIC_LABEL, resolveTopic, topicKey } from "../lib/habitTopics";
import {
  VERDICT_LABELS,
  VERDICT_STYLES,
  WEEK_LABELS,
  WEEKLY_TARGET_OPTIONS,
  normalizeDurationMin,
  normalizeWeeklyTarget,
  weeklyScorecard,
  type WeeklyScorecard,
} from "../lib/weeklyTracking";
import { useApp } from "../state/AppProvider";
import type { Bubble, TriangleType } from "../types";

function dayLabel(key: string): string {
  const [, m, d] = key.split("-");
  return `${Number(d)}.${Number(m)}`;
}

/** Color-coded 4-week grid: this week first, then the 3 closed weeks before it. */
export function WeeklyScorecardView({ card }: { card: WeeklyScorecard }) {
  return (
    <div className="space-y-1.5 rounded-xl bg-slate-50 p-2">
      <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
        <Target size={12} className="shrink-0" />
        יעד שבועי: {card.target} פעמים (ראשון–שבת)
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {card.weeks.map((week, index) => {
          const style = VERDICT_STYLES[week.verdict];
          return (
            <div
              key={week.start}
              className={`min-w-0 rounded-lg border px-1 py-1.5 text-center ${style.chip}`}
              title={`${dayLabel(week.start)}–${dayLabel(week.end)}`}
            >
              <div className="truncate text-[9px] font-bold opacity-80">{WEEK_LABELS[index]}</div>
              <div className="text-[15px] font-black leading-tight">
                {week.count}/{week.target}
              </div>
              <div className="mx-auto mt-0.5 h-1 w-4/5 overflow-hidden rounded-full bg-white/70">
                <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${week.ratio * 100}%` }} />
              </div>
              <div className="mt-0.5 truncate text-[9px] font-extrabold">{VERDICT_LABELS[week.verdict]}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Four dots for compact rows (oldest → current, reading order). */
export function WeeklyDots({ card }: { card: WeeklyScorecard }) {
  const current = card.weeks[0];
  return (
    <span className="inline-flex items-center gap-1" aria-label={`השבוע ${current?.count ?? 0} מתוך ${card.target}`}>
      {[...card.weeks].reverse().map((week) => (
        <span key={week.start} className={`h-2 w-2 rounded-full ${VERDICT_STYLES[week.verdict].dot}`} />
      ))}
      <span className="text-[10px] font-extrabold text-slate-500">
        {current?.count ?? 0}/{card.target}
      </span>
    </span>
  );
}

function DurationField({ item }: { item: Bubble }) {
  const { updateBubble } = useApp();
  const stored = normalizeDurationMin(item.habit_duration_min);
  const [draft, setDraft] = useState(stored === null ? "" : String(stored));
  useEffect(() => {
    setDraft(stored === null ? "" : String(stored));
  }, [stored]);
  return (
    <label className="flex h-10 items-center gap-2 rounded-xl bg-white px-3 ring-1 ring-slate-200">
      <span className="shrink-0 text-[11px] font-extrabold text-slate-500">דקות לפעם (משוער)</span>
      <input
        type="number"
        min={1}
        max={1440}
        inputMode="numeric"
        value={draft}
        placeholder="—"
        onChange={(e) => {
          setDraft(e.target.value);
          if (e.target.value === "") {
            updateBubble(item.id, { habit_duration_min: null });
            return;
          }
          const next = normalizeDurationMin(Number(e.target.value));
          if (next !== null) updateBubble(item.id, { habit_duration_min: next });
        }}
        className="h-9 min-w-0 flex-1 bg-transparent text-end text-sm font-extrabold text-slate-800 outline-none"
        aria-label="דקות לפעם"
      />
    </label>
  );
}

/**
 * Habit profile: weekly target (date-based templates only), topic, "why" and estimated
 * duration. All fields are bubble_extras keys, so edits sync per item with no schema change.
 */
export function HabitProfile({ item, type }: { item: Bubble; type: TriangleType }) {
  const { updateBubble, habitTopics } = useApp();
  const [open, setOpen] = useState(false);
  const weekly = supportsWeeklyTarget(type.template);
  const target = normalizeWeeklyTarget(item.weekly_target);
  const card = weekly ? weeklyScorecard(item, todayKey()) : null;
  const topic = resolveTopic(habitTopics, item.habit_topic);
  const orphan = topic && !habitTopics.some((name) => topicKey(name) === topicKey(topic)) ? topic : null;
  const topicChips = orphan ? [...habitTopics, orphan] : habitTopics;

  return (
    <div className="space-y-2 px-3 pb-2">
      {card && <WeeklyScorecardView card={card} />}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex h-9 w-full items-center gap-1.5 rounded-xl bg-slate-50 px-2.5 text-start text-[12px] font-extrabold text-slate-600 hover:bg-slate-100"
      >
        <span className="min-w-0 flex-1 truncate">
          פרופיל הרגל · {topic ?? NO_TOPIC_LABEL}
          {weekly && target !== null ? ` · ${target}× בשבוע` : ""}
        </span>
        <ChevronDown size={15} className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-2">
          {weekly && (
            <div className="space-y-1.5 rounded-xl bg-slate-50 p-2">
              <div className="text-[11px] font-bold text-slate-400">יעד שבועי (פעמים בשבוע, ראשון–שבת)</div>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="יעד שבועי">
                <button
                  type="button"
                  role="radio"
                  aria-checked={target === null}
                  onClick={() => updateBubble(item.id, { weekly_target: null })}
                  className={`h-8 rounded-lg px-2.5 text-xs font-bold ${
                    target === null ? "bg-slate-700 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
                  }`}
                >
                  ללא
                </button>
                {WEEKLY_TARGET_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={target === n}
                    onClick={() => updateBubble(item.id, { weekly_target: n })}
                    className={`h-8 min-w-8 rounded-lg px-2.5 text-xs font-bold ${
                      target === n ? "text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
                    }`}
                    style={target === n ? accentFill(type.color) : undefined}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-1.5 rounded-xl bg-slate-50 p-2">
            <div className="text-[11px] font-bold text-slate-400">תחום</div>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="תחום">
              <button
                type="button"
                role="radio"
                aria-checked={!topic}
                onClick={() => updateBubble(item.id, { habit_topic: "" })}
                className={`h-8 rounded-lg px-2.5 text-xs font-bold ${
                  !topic ? "bg-slate-700 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
                }`}
              >
                {NO_TOPIC_LABEL}
              </button>
              {topicChips.map((name) => {
                const active = Boolean(topic) && topicKey(name) === topicKey(topic ?? "");
                return (
                  <button
                    key={name}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => updateBubble(item.id, { habit_topic: name })}
                    className={`h-8 max-w-full truncate rounded-lg px-2.5 text-xs font-bold ${
                      active ? "bg-indigo-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="block rounded-xl bg-slate-50 p-2">
            <span className="text-[11px] font-bold text-slate-400">למה / התועלת</span>
            <textarea
              value={item.habit_why ?? ""}
              maxLength={2000}
              rows={2}
              onChange={(e) => updateBubble(item.id, { habit_why: e.target.value })}
              placeholder="למה ההרגל הזה חשוב לי?"
              className="mt-1 w-full resize-y rounded-lg bg-white px-2.5 py-2 text-sm font-semibold text-slate-800 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-200"
            />
          </label>
          <DurationField item={item} />
        </div>
      )}
    </div>
  );
}
