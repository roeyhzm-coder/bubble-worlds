import { Check, ChevronLeft, Pencil, Plus, Triangle } from "lucide-react";
import { useState } from "react";
import { trackingProgress } from "../lib/tracking";
import { useApp } from "../state/AppProvider";
import type { Bubble } from "../types";

export function InnerList({ items }: { items: Bubble[] }) {
  const {
    childrenOf,
    updateBubble,
    addBubble,
    openEditor,
    setDrill,
    markToday,
  } = useApp();
  const [draft, setDraft] = useState("");
  const [openTrack, setOpenTrack] = useState<string | null>(null);

  const submit = () => {
    const title = draft.trim();
    if (!title) return;
    addBubble({ title, openEditor: false });
    setDraft("");
  };

  return (
    <div className="flex h-full flex-col px-3 pb-24">
      <form
        className="mb-2 flex h-12 items-center gap-2 rounded-2xl bg-white px-3 shadow-soft"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Plus size={16} className="text-slate-400" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="פריט חדש לרשימה…"
          className="h-11 min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none"
        />
      </form>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto no-scrollbar">
        {items.length === 0 && (
          <div className="grid h-32 place-items-center text-sm text-slate-400">
            הרשימה ריקה. כתבו שם ולחצו Enter.
          </div>
        )}
        {items.map((item) => {
          const kids = childrenOf(item.id).length;
          const progress = trackingProgress(item);
          const trackOpen = openTrack === item.id;
          return (
            <div key={item.id} className="rounded-2xl bg-white/90 shadow-soft">
              <div className="flex h-12 items-center gap-2 px-2">
                {item.is_tracking ? (
                  <button
                    type="button"
                    aria-label="מעקב"
                    onClick={() =>
                      setOpenTrack((cur) => (cur === item.id ? null : item.id))
                    }
                    className="grid h-10 w-10 place-items-center"
                  >
                    <Triangle
                      size={18}
                      fill={item.color}
                      color={item.color}
                      className="drop-shadow-sm"
                    />
                  </button>
                ) : (
                  <span className="w-2" />
                )}
                <input
                  value={item.title}
                  onChange={(e) => updateBubble(item.id, { title: e.target.value })}
                  className="h-11 min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-slate-800 outline-none"
                />
                {kids > 0 && (
                  <button
                    type="button"
                    onClick={() => setDrill({ kind: "bubble", id: item.id })}
                    className="grid h-10 w-10 place-items-center text-slate-400"
                    aria-label="כניסה"
                  >
                    <ChevronLeft size={18} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openEditor({ type: "bubble", id: item.id })}
                  className="grid h-10 w-10 place-items-center text-slate-400"
                  aria-label="עריכה"
                >
                  <Pencil size={15} />
                </button>
              </div>
              {trackOpen && (
                <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-2">
                  <div className="text-xs font-bold text-slate-500">
                    {progress.done}/{progress.target} ימים
                  </div>
                  <button
                    type="button"
                    onClick={() => markToday(item.id)}
                    className="inline-flex h-9 items-center gap-1 rounded-xl bg-sky-500 px-3 text-xs font-extrabold text-white"
                  >
                    <Check size={14} />
                    בוצע היום
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
