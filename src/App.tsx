import { AlertTriangle, Cloud, CloudOff, CloudUpload, Download, Loader2, Plus } from "lucide-react";
import { Suspense, lazy, useEffect, useState, type ReactElement } from "react";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { DailyTasks } from "./components/DailyTasks";
import { FocusHub } from "./components/FocusHub";
import { PageSwitcher, SwipePager } from "./components/SwipePager";
import { UndoToast } from "./components/UndoToast";
import { WorldMap } from "./components/WorldMap";
import { useApp } from "./state/AppProvider";

// Secondary pages and the editor sheet load on first use to keep startup light on mobile.
const Successes = lazy(() => import("./components/Successes").then((m) => ({ default: m.Successes })));
const TriangleStudio = lazy(() =>
  import("./components/TriangleStudio").then((m) => ({ default: m.TriangleStudio })),
);
const EditDrawer = lazy(() => import("./components/EditDrawer").then((m) => ({ default: m.EditDrawer })));

const LAZY_PAGES = new Set([3, 4]);

function PageSkeleton() {
  return (
    <div className="space-y-2 px-3 pt-1" aria-busy="true" aria-label="טוען…">
      <div className="h-6 w-32 animate-pulse rounded-lg bg-slate-200/70" />
      {[0, 1, 2].map((row) => (
        <div key={row} className="h-14 animate-pulse rounded-2xl bg-white/80" />
      ))}
    </div>
  );
}

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
    forcePushLocalToCloud,
    exportBackup,
    navLock,
    composer,
  } = useApp();
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [visited, setVisited] = useState<Set<number>>(() => new Set([page]));
  const [editorUsed, setEditorUsed] = useState(false);
  const [forceOpen, setForceOpen] = useState(false);
  const [forcing, setForcing] = useState(false);
  const syncFailed = cloud && lastPush !== null && !lastPush.ok;

  useEffect(() => {
    setVisited((current) => (current.has(page) ? current : new Set(current).add(page)));
  }, [page]);

  // Once opened, the editor stays mounted so its exit animation can play.
  useEffect(() => {
    if (composer) setEditorUsed(true);
  }, [composer]);

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

  const handleForcePush = async () => {
    if (forcing) return;
    setForcing(true);
    try {
      const result = await forcePushLocalToCloud();
      if (result.ok) {
        setForceOpen(false);
        setNotice("הענן עודכן בהצלחה לפי המכשיר הזה");
      } else {
        setNotice(`הסנכרון הכפוי נכשל: ${result.errors[0] ?? "שגיאה לא ידועה"}`);
      }
    } finally {
      setForcing(false);
    }
  };

  const handleBackup = () => {
    exportBackup();
    setNotice("קובץ גיבוי נשמר במכשיר");
  };

  const lazyPage = (index: number, node: ReactElement) =>
    LAZY_PAGES.has(index) && !visited.has(index) ? <PageSkeleton /> : <Suspense fallback={<PageSkeleton />}>{node}</Suspense>;

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] w-full max-w-[100vw] flex-col overflow-hidden overflow-x-hidden bg-gradient-to-br from-slate-50 via-slate-100/70 to-indigo-50/40">
      <header className="shrink-0 px-3 pb-1 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between px-1">
          <div className="text-lg font-extrabold tracking-tight text-slate-800">
            עולמות
          </div>
          <div className="flex items-center gap-1.5">
            {syncFailed ? (
              <button
                type="button"
                onClick={() => setForceOpen(true)}
                className="flex h-8 items-center gap-1 rounded-full bg-amber-50 px-2.5 text-[11px] font-bold text-rose-600 ring-1 ring-amber-300 active:scale-95"
                aria-haspopup="dialog"
                title="פתרון שגיאת הסנכרון"
              >
                <AlertTriangle size={12} className="text-amber-500" />
                שגיאת סנכרון
              </button>
            ) : (
              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                {cloud ? <Cloud size={12} /> : <CloudOff size={12} />}
                {cloud ? "סנכרון בענן" : "שמירה מקומית"}
              </div>
            )}
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
              title="דחיפה ידנית לענן"
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

      <SwipePager page={page} onPage={setPage} locked={dragging || navLock}>
        <WorldMap onDragChange={setDragging} />
        <DailyTasks />
        <FocusHub />
        {lazyPage(3, <Successes />)}
        {lazyPage(4, <TriangleStudio />)}
      </SwipePager>

      {page !== 2 && page !== 3 && (
        <button
          type="button"
          onClick={() => {
            if (page === 1) addDailyTask();
            else if (page === 4) addTriangleType();
            else requestCreate();
          }}
          className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] end-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-slate-800 to-slate-950 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_12px_26px_-10px_rgba(79,70,229,0.55)] active:scale-95"
          aria-label={page === 1 ? "הוספת משימה" : page === 4 ? "הוספת סוג משולש" : "הוספה"}
          title={page === 1 ? "הוספת משימה" : page === 4 ? "הוספת סוג משולש" : "הוספה"}
        >
          <Plus size={24} />
        </button>
      )}

      {editorUsed && (
        <Suspense fallback={null}>
          <EditDrawer />
        </Suspense>
      )}
      <UndoToast />
      <ConfirmDialog
        open={forceOpen}
        tone="warning"
        busy={forcing}
        title="שגיאת סנכרון מתמשכת"
        body="האם תרצה לדרוס את נתוני הענן ולעדכן אותם בדיוק לפי מה שמופיע כעת במכשיר זה?"
        confirmLabel="דרוס ענן וסנכרן (Force Sync) ☁️"
        onCancel={() => setForceOpen(false)}
        onConfirm={() => void handleForcePush()}
      >
        {lastPush && lastPush.errors.length > 0 && (
          <ul className="mt-3 space-y-1 rounded-xl bg-amber-50 p-2.5 text-[11px] text-amber-800 ring-1 ring-amber-200" dir="auto">
            {lastPush.errors.map((error) => (
              <li key={error} className="break-words">{error}</li>
            ))}
          </ul>
        )}
      </ConfirmDialog>
    </div>
  );
}
