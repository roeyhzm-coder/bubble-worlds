import { useApp } from "../state/AppProvider";
import type { WorldKind } from "../types";

export function WorldKindPicker() {
  const { lockWorldKind, openCreate } = useApp();

  const choose = (kind: WorldKind) => {
    lockWorldKind(kind);
    if (kind === "bubbles") openCreate("bubble");
  };

  return (
    <div className="grid h-full place-items-center px-6">
      <div className="w-full max-w-sm space-y-3 text-center">
        <div className="text-base font-extrabold text-slate-800">איזה עולם ליצור כאן?</div>
        <p className="text-xs font-semibold text-slate-500">
          הבחירה ננעלת לעולם הזה. אפשר ליצור רק בועות או רק רשימה.
        </p>
        <button
          type="button"
          onClick={() => choose("bubbles")}
          className="flex h-14 w-full items-center justify-center rounded-2xl bg-white text-[15px] font-extrabold text-slate-800 shadow-soft"
        >
          🫧 צור עולם בועות
        </button>
        <button
          type="button"
          onClick={() => choose("list")}
          className="flex h-14 w-full items-center justify-center rounded-2xl bg-white text-[15px] font-extrabold text-slate-800 shadow-soft"
        >
          📝 צור רשימה
        </button>
      </div>
    </div>
  );
}
