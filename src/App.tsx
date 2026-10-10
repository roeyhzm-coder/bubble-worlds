import { Cloud, CloudOff, Plus } from "lucide-react";
import { useState } from "react";
import { EditDrawer } from "./components/EditDrawer";
import { FocusHub } from "./components/FocusHub";
import { DotIndicator, SwipePager } from "./components/SwipePager";
import { WorldMap } from "./components/WorldMap";
import { useApp } from "./state/AppProvider";

export default function App() {
  const { page, setPage, cloud, drill, addCategory, addBubble } = useApp();
  const [dragging, setDragging] = useState(false);

  return (
    <div className="flex h-[100dvh] w-full flex-col bg-canvas">
      <header className="flex items-center justify-between px-4 pt-[max(0.6rem,env(safe-area-inset-top))]">
        <div>
          <div className="text-lg font-extrabold tracking-tight text-slate-800">
            עולמות
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            {cloud ? <Cloud size={12} /> : <CloudOff size={12} />}
            {cloud ? "סנכרון בענן" : "שמירה מקומית"}
          </div>
        </div>
        <DotIndicator page={page} count={2} onPage={setPage} />
      </header>

      <SwipePager page={page} onPage={setPage} locked={dragging}>
        <WorldMap onDragChange={setDragging} />
        <FocusHub />
      </SwipePager>

      <button
        type="button"
        onClick={() => (drill.kind === "root" ? addCategory() : addBubble())}
        className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] end-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-slate-900 text-white shadow-bubble"
        aria-label="הוספה"
      >
        <Plus size={24} />
      </button>

      <EditDrawer />
    </div>
  );
}
