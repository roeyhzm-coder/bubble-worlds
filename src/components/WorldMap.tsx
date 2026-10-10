import { ArrowRight } from "lucide-react";
import { useApp } from "../state/AppProvider";
import { BubbleNode } from "./BubbleNode";

interface WorldMapProps {
  onDragChange: (dragging: boolean) => void;
}

export function WorldMap({ onDragChange }: WorldMapProps) {
  const {
    drill,
    setDrill,
    breadcrumbs,
    currentTitle,
    visibleCategories,
    visibleBubbles,
    snapshot,
    childrenOf,
    openEditor,
    moveNode,
  } = useApp();

  const parentCrumb = breadcrumbs[breadcrumbs.length - 2];

  return (
    <section className="flex h-full flex-col">
      <div className="flex h-12 items-center gap-2 px-3">
        {drill.kind !== "root" && parentCrumb && (
          <button
            type="button"
            onClick={() => setDrill(parentCrumb.node)}
            className="inline-flex h-9 items-center gap-1 rounded-xl bg-white px-2.5 text-sm font-semibold text-slate-600 shadow-soft"
          >
            <ArrowRight size={16} />
            חזרה
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-extrabold text-slate-800">
            {currentTitle}
          </div>
          {breadcrumbs.length > 1 && (
            <div className="truncate text-[11px] text-slate-400">
              {breadcrumbs.map((c) => c.label).join(" · ")}
            </div>
          )}
        </div>
      </div>

      <div data-canvas className="relative min-h-0 flex-1 overflow-hidden">
        {visibleCategories.length === 0 && visibleBubbles.length === 0 && (
          <div className="absolute inset-0 grid place-items-center px-8 text-center text-sm text-slate-400">
            אין כאן בועות עדיין. לחצו על + כדי לפתוח עולם חדש.
          </div>
        )}

        {visibleCategories.map((cat) => (
          <BubbleNode
            key={cat.id}
            item={cat}
            type="category"
            childCount={
              snapshot.bubbles.filter(
                (b) => b.category_id === cat.id && b.parent_bubble_id === null,
              ).length
            }
            onOpen={() => setDrill({ kind: "category", id: cat.id })}
            onEdit={() => openEditor({ type: "category", id: cat.id })}
            onMove={(x, y) => moveNode("category", cat.id, x, y)}
            onDragChange={onDragChange}
          />
        ))}

        {visibleBubbles.map((bub) => (
          <BubbleNode
            key={bub.id}
            item={bub}
            type="bubble"
            childCount={childrenOf(bub.id).length}
            onOpen={() => setDrill({ kind: "bubble", id: bub.id })}
            onEdit={() => openEditor({ type: "bubble", id: bub.id })}
            onMove={(x, y) => moveNode("bubble", bub.id, x, y)}
            onDragChange={onDragChange}
          />
        ))}
      </div>
    </section>
  );
}
