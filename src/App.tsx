import { Cloud, CloudOff, Plus } from "lucide-react";
import { useState } from "react";
import { EditDrawer } from "./components/EditDrawer";
import { FocusHub } from "./components/FocusHub";
import { PageSwitcher, SwipePager } from "./components/SwipePager";
import { TriangleStudio } from "./components/TriangleStudio";
import { WorldMap } from "./components/WorldMap";
import { useApp } from "./state/AppProvider";

export default function App() {
  const { page, setPage, cloud, requestCreate, addTriangleType } = useApp();
  const [dragging, setDragging] = useState(false);

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden bg-canvas">
      <header className="shrink-0 px-3 pb-1 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between px-1">
          <div className="text-lg font-extrabold tracking-tight text-slate-800">
            עולמות
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            {cloud ? <Cloud size={12} /> : <CloudOff size={12} />}
            {cloud ? "סנכרון בענן" : "שמירה מקומית"}
          </div>
        </div>
        <PageSwitcher page={page} onPage={setPage} />
      </header>

      <SwipePager page={page} onPage={setPage} locked={dragging}>
        <WorldMap onDragChange={setDragging} />
        <FocusHub />
        <TriangleStudio />
      </SwipePager>

      {page !== 1 && (
        <button
          type="button"
          onClick={() => (page === 2 ? addTriangleType() : requestCreate())}
          className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] end-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-slate-900 text-white shadow-bubble"
          aria-label="הוספה"
        >
          <Plus size={24} />
        </button>
      )}

      <EditDrawer />
    </div>
  );
}
