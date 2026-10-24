import { ArrowDown, ArrowUp } from "lucide-react";

/** Compact ↑/↓ pair for moving one row within its list. */
export function ReorderButtons({
  title,
  isFirst,
  isLast,
  onMove,
}: {
  title: string;
  isFirst: boolean;
  isLast: boolean;
  onMove: (direction: -1 | 1) => void;
}) {
  const name = title || "פריט";
  return (
    <span className="flex shrink-0 items-center gap-1" role="group" aria-label={`סידור ${name}`}>
      <button
        type="button"
        disabled={isFirst}
        onClick={(e) => {
          e.stopPropagation();
          onMove(-1);
        }}
        className="grid h-10 w-10 place-items-center rounded-xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-30"
        aria-label={`הזזת ${name} למעלה`}
        title="למעלה"
      >
        <ArrowUp size={16} />
      </button>
      <button
        type="button"
        disabled={isLast}
        onClick={(e) => {
          e.stopPropagation();
          onMove(1);
        }}
        className="grid h-10 w-10 place-items-center rounded-xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-30"
        aria-label={`הזזת ${name} למטה`}
        title="למטה"
      >
        <ArrowDown size={16} />
      </button>
    </span>
  );
}
