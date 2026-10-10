import { ArrowRight, LayoutGrid, List } from "lucide-react";
import { useRef } from "react";
import { useApp } from "../state/AppProvider";
import { BubbleNode } from "./BubbleNode";
import { InnerList } from "./InnerList";

interface WorldMapProps {
  onDragChange: (dragging: boolean) => void;
}

export function WorldMap({ onDragChange }: WorldMapProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const {
    drill,
    setDrill,
    breadcrumbs,
    currentTitle,
    visibleCategories,
    visibleBubbles,
    snapshot,
    openEditor,
    moveNode,
    drillKey,
    toggleListView,
  } = useApp();

  const parentCrumb = breadcrumbs[breadcrumbs.length - 2];
  const backLabel =
    parentCrumb?.node.kind === "root"
      ? "חזרה לעולם הראשי"
      : parentCrumb
        ? `חזרה ל${parentCrumb.label}`
        : "חזרה";
  const listMode = drill.kind !== "root" && Boolean(snapshot.listViews[drillKey]);
  const canvasItems =
    drill.kind === "root" ? visibleCategories : visibleBubbles;

  return (
    <section className="flex h-full flex-col">
      <div className="flex shrink-0 items-start justify-between gap-2 px-3 pb-1">
        <div className="min-w-0 space-y-1.5">
          {drill.kind !== "root" && parentCrumb && (
            <button
              type="button"
              onClick={() => setDrill(parentCrumb.node)}
              className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white px-3.5 text-[15px] font-extrabold text-slate-800 shadow-soft"
            >
              <ArrowRight size={20} />
              {backLabel}
            </button>
          )}
          {drill.kind !== "root" && (
            <div className="truncate text-[13px] font-extrabold text-slate-800">
              {currentTitle}
            </div>
          )}
          {breadcrumbs.length > 1 && (
            <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-400">
              {breadcrumbs.map((crumb, index) => (
                <button
                  key={crumb.id}
                  type="button"
                  onClick={() => setDrill(crumb.node)}
                  className={
                    index === breadcrumbs.length - 1
                      ? "font-bold text-slate-600"
                      : "underline-offset-2 hover:underline"
                  }
                >
                  {crumb.label}
                  {index < breadcrumbs.length - 1 ? " ·" : ""}
                </button>
              ))}
            </div>
          )}
        </div>
        {drill.kind !== "root" && (
          <div className="mt-0.5 flex h-12 shrink-0 rounded-2xl bg-white p-1 shadow-soft">
            <button
              type="button"
              onClick={() => {
                if (listMode) toggleListView(drillKey);
              }}
              className={`inline-flex h-10 items-center gap-1 rounded-xl px-2.5 text-[11px] font-extrabold ${
                !listMode ? "bg-slate-900 text-white" : "text-slate-500"
              }`}
            >
              <LayoutGrid size={14} />
              בועות
            </button>
            <button
              type="button"
              onClick={() => {
                if (!listMode) toggleListView(drillKey);
              }}
              className={`inline-flex h-10 items-center gap-1 rounded-xl px-2.5 text-[11px] font-extrabold ${
                listMode ? "bg-slate-900 text-white" : "text-slate-500"
              }`}
            >
              <List size={14} />
              רשימה
            </button>
          </div>
        )}
      </div>

      {listMode ? (
        <InnerList items={visibleBubbles} />
      ) : (
        <div
          ref={canvasRef}
          data-canvas
          className="relative min-h-0 flex-1 overflow-hidden"
        >
          {canvasItems.length === 0 && (
            <div className="absolute inset-0 grid place-items-center px-8 text-center text-sm text-slate-400">
              אין כאן בועות עדיין. לחצו על + כדי ליצור בועה.
            </div>
          )}

          {drill.kind === "root" &&
            visibleCategories.map((cat) => (
              <BubbleNode
                key={cat.id}
                item={cat}
                type="category"
                canvasRef={canvasRef}
                onOpen={() => setDrill({ kind: "category", id: cat.id })}
                onEdit={() => openEditor({ type: "category", id: cat.id })}
                onMove={(x, y) => moveNode("category", cat.id, x, y)}
                onDragChange={onDragChange}
              />
            ))}

          {drill.kind !== "root" &&
            visibleBubbles.map((bub) => (
              <BubbleNode
                key={bub.id}
                item={bub}
                type="bubble"
                canvasRef={canvasRef}
                onOpen={() => setDrill({ kind: "bubble", id: bub.id })}
                onEdit={() => openEditor({ type: "bubble", id: bub.id })}
                onMove={(x, y) => moveNode("bubble", bub.id, x, y)}
                onDragChange={onDragChange}
              />
            ))}
        </div>
      )}
    </section>
  );
}
