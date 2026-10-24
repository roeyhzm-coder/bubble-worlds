import { Moon, Plus, Sun, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { archivedTasks, bangs, dateTasks, tomorrowKey } from "../lib/daily";
import { todayKey } from "../lib/defaults";
import { useApp } from "../state/AppProvider";

export function DailyTasks() {
  const {
    snapshot,
    addDailyTask,
    updateDailyTask,
    deleteDailyTask,
    toggleDailyTask,
    dailyViewDate,
    setDailyViewDate,
    moveDailyTask,
  } = useApp();
  const [showArchive, setShowArchive] = useState(false);
  const today = todayKey();
  const tomorrow = tomorrowKey();
  const planningTomorrow = dailyViewDate === tomorrow;
  const viewDate = planningTomorrow ? tomorrow : today;
  const items = useMemo(
    () => dateTasks(snapshot.dailyTasks, viewDate),
    [snapshot.dailyTasks, viewDate],
  );
  const archive = useMemo(
    () => archivedTasks(snapshot.dailyTasks, today),
    [snapshot.dailyTasks, today],
  );
  const done = items.filter((item) => item.completed && item.text.trim()).length;
  const total = items.filter((item) => item.text.trim()).length;

  return (
    <section className="flex h-full min-w-0 flex-col overflow-x-hidden">
      <div className="px-3 pb-2">
        <div className="text-[15px] font-extrabold text-slate-800">
          {snapshot.pageLabels.daily}
        </div>
        <div className="mb-2 text-[11px] font-bold text-slate-400">
          {planningTomorrow
            ? "תכנון לילה למחר · ללא סימני דחייה"
            : `${done}/${total || 6} הושלמו · דחייה רק ממשימות אתמול`}
        </div>
        <div className="card grid grid-cols-2 gap-1.5 p-1">
          <button
            type="button"
            onClick={() => setDailyViewDate(today)}
            className={`flex h-10 items-center justify-center gap-1 rounded-xl text-[12px] font-extrabold ${
              !planningTomorrow ? "bg-gradient-to-b from-amber-100 to-amber-200/70 text-amber-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]" : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            <Sun size={14} />
            משימות להיום
          </button>
          <button
            type="button"
            onClick={() => setDailyViewDate(tomorrow)}
            className={`flex h-10 items-center justify-center gap-1 rounded-xl text-[12px] font-extrabold ${
              planningTomorrow ? "bg-gradient-to-b from-indigo-100 to-indigo-200/70 text-indigo-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]" : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            <Moon size={14} />
            תכנון למחר
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden px-3 pb-24 no-scrollbar">
        {items.map((item, index) => {
          const marks = planningTomorrow ? "" : bangs(item.rollover_count);
          return (
            <div
              key={item.id}
              className={`card px-2 py-1 ${
                item.completed ? "opacity-55" : ""
              }`}
            >
              <div className="flex min-h-12 items-center gap-1.5">
                <span className="w-5 shrink-0 text-center text-[12px] font-extrabold text-slate-400">
                  {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => toggleDailyTask(item.id)}
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-extrabold ${
                    item.completed ? "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_6px_14px_-6px_rgba(16,185,129,0.7)]" : "bg-slate-100 text-slate-400 hover:bg-slate-200/70"
                  }`}
                  aria-label={item.completed ? "בטל סימון" : "סמן כהושלם"}
                >
                  V
                </button>
                {marks && (
                  <span className="shrink-0 text-[15px] font-black leading-none text-rose-500">
                    {marks}
                  </span>
                )}
                <input
                  value={item.text}
                  onChange={(e) => updateDailyTask(item.id, { text: e.target.value })}
                  placeholder={planningTomorrow ? "משימה למחר…" : "משימה להיום…"}
                  className={`h-11 min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-slate-800 outline-none ${
                    item.completed ? "line-through" : ""
                  }`}
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteDailyTask(item.id);
                  }}
                  className="grid h-10 w-8 shrink-0 place-items-center text-rose-400"
                  aria-label={`מחיקת המשימה ${item.text || index + 1}`}
                  title="מחיקה"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              {item.text.trim() && (
                <button
                  type="button"
                  onClick={() => moveDailyTask(item.id, planningTomorrow ? today : tomorrow)}
                  className="mb-1 h-7 w-full rounded-lg text-[11px] font-extrabold text-slate-400 hover:bg-slate-50"
                >
                  {planningTomorrow ? "העבר להיום" : "העבר למחר"}
                </button>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={addDailyTask}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white/70 text-sm font-extrabold text-slate-600 hover:bg-white"
        >
          <Plus size={16} />
          הוסף משימה
        </button>

        {!planningTomorrow && archive.length > 0 && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowArchive((v) => !v)}
              className="h-8 text-[11px] font-extrabold text-slate-400"
            >
              {showArchive ? "הסתר היסטוריה" : `היסטוריה (${archive.length})`}
            </button>
            {showArchive && (
              <div className="space-y-1.5">
                {archive.map((item) => (
                  <div
                    key={item.id}
                    className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200/60 bg-white/70 px-3 text-[13px] text-slate-500"
                  >
                    <span className="text-[11px] font-bold">{item.date.slice(5)}</span>
                    <span className="min-w-0 flex-1 truncate line-through">{item.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
