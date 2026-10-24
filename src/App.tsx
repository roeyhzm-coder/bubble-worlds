import { Cloud, CloudOff, CloudUpload, Download, Loader2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { DailyTasks } from "./components/DailyTasks";
import { EditDrawer } from "./components/EditDrawer";
import { FocusHub } from "./components/FocusHub";
import { PageSwitcher, SwipePager } from "./components/SwipePager";
import { Successes } from "./components/Successes";
import { TriangleStudio } from "./components/TriangleStudio";
import { WorldMap } from "./components/WorldMap";
import { useApp } from "./state/AppProvider";

export default function App() {
  const {
    page,
    setPage,
    cloud,
    requestCreate,
    addTriangleType,
    addDailyTask,
    syncing,
    lastPush,
    pushToCloud,
    exportBackup,
  } = useApp();
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const handlePush = async () => {
    if (syncing) return;
    const result = await pushToCloud();
    setNotice(
      result.ok
        ? `נדחף לענן: ${result.categories} עולמות, ${result.bubbles} בועות`
        : `הדחיפה נכשלה: ${result.errors[0] ?? "שגיאה לא ידועה"}`,
    );
  };

  const handleBackup = () => {
    exportBackup();
    setNotice("קובץ גיבוי נשמר במכשיר");
  };

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] w-full max-w-[100vw] flex-col overflow-hidden overflow-x-hidden bg-gradient-to-br from-slate-50 via-slate-100/70 to-indigo-50/40">
      <header className="shrink-0 px-3 pb-1 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between px-1">
          <div className="text-lg font-extrabold tracking-tight text-slate-800">
            עולמות
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className={`flex items-center gap-1 text-[11px] ${
                lastPush && !lastPush.ok ? "text-rose-500" : "text-slate-400"
              }`}
            >
              {cloud ? <Cloud size={12} /> : <CloudOff size={12} />}
              {cloud ? (lastPush && !lastPush.ok ? "שגיאת סנכרון" : "סנכרון בענן") : "שמירה מקומית"}
            </div>
            <button
              type="button"
              onClick={handleBackup}
              className="grid h-8 w-8 place-items-center rounded-full bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 active:scale-95"
              aria-label="גיבוי לקובץ"
              title="גיבוי לקובץ"
            >
              <Download size={15} />
            </button>
            <button
              type="button"
              onClick={() => void handlePush()}
              disabled={!cloud || syncing}
              aria-busy={syncing}
              className="flex h-8 items-center gap-1 rounded-full bg-slate-900 px-3 text-[11px] font-bold text-white shadow-sm active:scale-95 disabled:opacity-50"
              aria-label="דחיפה ידנית לענן"
            >
              {syncing ? <Loader2 size={14} className="animate-spin" /> : <CloudUpload size={14} />}
              {syncing ? "דוחף…" : "דחוף לענן"}
            </button>
          </div>
        </div>
        {notice && (
          <div
            role="status"
            className="mx-1 mt-1 rounded-lg bg-slate-800 px-3 py-1.5 text-center text-[11px] text-white"
          >
            {notice}
          </div>
        )}
        <PageSwitcher page={page} onPage={setPage} />
      </header>

      <SwipePager page={page} onPage={setPage} locked={dragging}>
        <WorldMap onDragChange={setDragging} />
        <FocusHub />
        <DailyTasks />
        <Successes />
        <TriangleStudio />
      </SwipePager>

      {page !== 1 && page !== 3 && (
        <button
          type="button"
          onClick={() => {
            if (page === 2) addDailyTask();
            else if (page === 4) addTriangleType();
            else requestCreate();
          }}
          className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] end-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-slate-800 to-slate-950 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_12px_26px_-10px_rgba(79,70,229,0.55)] active:scale-95"
          aria-label="הוספה"
        >
          <Plus size={24} />
        </button>
      )}

      <EditDrawer />
    </div>
  );
}
