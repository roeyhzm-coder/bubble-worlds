import { ArrowRight, ChevronLeft } from "lucide-react";
import { useRef } from "react";
import { useApp } from "../state/AppProvider";
import { BubbleNode } from "./BubbleNode";
import { InnerList } from "./InnerList";
import { WorldKindPicker } from "./WorldKindPicker";

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
    currentWorldKind,
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
  const needsKind = drill.kind !== "root" && currentWorldKind === null;
  const listMode = drill.kind !== "root" && currentWorldKind === "list";
  const canvasItems = drill.kind === "root" ? visibleCategories : visibleBubbles;

  return (
    <section className="flex h-full min-w-0 flex-col overflow-x-hidden">
      {drill.kind !== "root" && (
        <div className="shrink-0 space-y-1.5 px-3 pb-2">
          <div className="flex min-w-0 items-center gap-2">
            {parentCrumb && (
              <button
                type="button"
                onClick={() => setDrill(parentCrumb.node)}
                className="card inline-flex h-11 min-w-0 max-w-[70%] shrink-0 items-center gap-1.5 px-3 text-[14px] font-extrabold text-slate-800"
              >
                <ArrowRight size={18} className="shrink-0" />
                <span className="truncate">{backLabel}</span>
              </button>
            )}
            <div className="min-w-0 flex-1 truncate text-[14px] font-extrabold text-slate-800">
              {currentTitle}
            </div>
          </div>
          {breadcrumbs.length > 2 && (
            <nav
              aria-label="מסלול ניווט"
              className="-mx-3 flex items-center gap-1 overflow-x-auto px-3 no-scrollbar"
            >
              {breadcrumbs.map((crumb, index) => {
                const last = index === breadcrumbs.length - 1;
                return (
                  <span key={crumb.id} className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      disabled={last}
                      aria-current={last ? "page" : undefined}
                      onClick={() => setDrill(crumb.node)}
                      className={`h-7 max-w-[10rem] truncate rounded-full px-2.5 text-[11px] font-extrabold ${
                        last
                          ? "bg-gradient-to-b from-slate-700 to-slate-900 text-white shadow-sm"
                          : "border border-slate-200/80 bg-white/90 text-slate-600 shadow-sm hover:bg-white"
                      }`}
                    >
                      {index === 0 ? "🌐 " : ""}
                      {crumb.label || "ללא שם"}
                    </button>
                    {!last && <ChevronLeft size={12} className="shrink-0 text-slate-300" />}
                  </span>
                );
              })}
            </nav>
          )}
        </div>
      )}

      {needsKind ? (
        <WorldKindPicker />
      ) : listMode ? (
        <InnerList items={visibleBubbles} />
      ) : (
        <div
          ref={canvasRef}
          data-canvas
          className="relative min-h-0 flex-1 overflow-hidden"
        >
          {canvasItems.length === 0 && (
            <div className="absolute inset-0 grid place-items-center px-8 text-center text-sm text-slate-400">
              אין כאן בועות עדיין. לחצו על + כדי ליצור בועה עגולה.
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
