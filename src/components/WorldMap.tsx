import { ArrowRight } from "lucide-react";
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
    openEditor,
    moveNode,
  } = useApp();

  const parentCrumb = breadcrumbs[breadcrumbs.length - 2];
  const backLabel =
    parentCrumb?.node.kind === "root"
      ? "חזרה לעולם הראשי"
      : parentCrumb
        ? `חזרה ל${parentCrumb.label}`
        : "חזרה";

  return (
    <section className="flex h-full flex-col">
      <div className="shrink-0 space-y-1.5 px-3 pb-1">
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

      {drill.kind !== "root" ? (
        <InnerList items={visibleBubbles} />
      ) : (
        <div
          ref={canvasRef}
          data-canvas
          className="relative min-h-0 flex-1 overflow-hidden"
        >
          {visibleCategories.length === 0 && (
            <div className="absolute inset-0 grid place-items-center px-8 text-center text-sm text-slate-400">
              אין כאן בועות עדיין. לחצו על + כדי ליצור בועה.
            </div>
          )}

          {visibleCategories.map((cat) => (
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
        </div>
      )}
    </section>
  );
}
