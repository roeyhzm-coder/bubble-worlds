import { Check, ChevronDown, ChevronUp, Pencil, Plus, Settings2, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { MAX_TOPIC_LENGTH, topicKey } from "../lib/habitTopics";
import { useApp } from "../state/AppProvider";
import { ViewportModal } from "./ViewportModal";

/**
 * "ניהול תחומים": add, rename (linked habits follow), reorder and delete topics.
 * Deleting a topic only clears it from its habits; no habit is ever removed.
 */
export function HabitTopicsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { snapshot, habitTopics, addHabitTopic, renameHabitTopic, deleteHabitTopic, moveHabitTopic } = useApp();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);

  const usage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const bubble of snapshot.bubbles) {
      if (bubble.archived || !bubble.habit_topic?.trim()) continue;
      const k = topicKey(bubble.habit_topic);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return counts;
  }, [snapshot.bubbles]);

  const close = () => {
    setEditing(null);
    setConfirming(null);
    setError(null);
    onClose();
  };

  const add = () => {
    const message = addHabitTopic(draft);
    setError(message);
    if (!message) setDraft("");
  };

  const saveRename = (from: string) => {
    const message = editDraft.trim() === from ? null : renameHabitTopic(from, editDraft);
    setError(message);
    if (!message) setEditing(null);
  };

  return (
    <ViewportModal
      open={open}
      onClose={close}
      titleId="habit-topics-title"
      title={
        <>
          <Settings2 size={17} className="shrink-0 text-indigo-500" />
          ניהול תחומים
        </>
      }
    >
      <form
        className="flex items-center gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          data-autofocus
          value={draft}
          maxLength={MAX_TOPIC_LENGTH}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          placeholder="שם תחום חדש…"
          aria-label="שם תחום חדש"
          enterKeyHint="done"
          className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none focus:border-transparent focus:bg-white focus:ring-2 focus:ring-indigo-200"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="inline-flex h-11 shrink-0 items-center gap-1 rounded-xl bg-indigo-600 px-3 text-[13px] font-extrabold text-white disabled:opacity-40"
        >
          <Plus size={15} />
          הוסף
        </button>
      </form>
      {error && <div className="mt-1.5 text-[12px] font-bold text-rose-600">{error}</div>}

      <div className="mt-3 space-y-1.5">
        {habitTopics.length === 0 && (
          <div className="rounded-xl bg-slate-50 px-3 py-5 text-center text-[12px] font-bold text-slate-400">
            אין תחומים עדיין. הוסיפו תחום ראשון למעלה.
          </div>
        )}
        {habitTopics.map((topic, index) => {
          const count = usage.get(topicKey(topic)) ?? 0;
          if (editing === topic) {
            return (
              <form
                key={topic}
                className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/40 p-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveRename(topic);
                }}
              >
                <input
                  autoFocus
                  value={editDraft}
                  maxLength={MAX_TOPIC_LENGTH}
                  onChange={(e) => {
                    setEditDraft(e.target.value);
                    setError(null);
                  }}
                  aria-label={`שם חדש ל${topic}`}
                  enterKeyHint="done"
                  className="h-10 min-w-0 flex-1 rounded-lg bg-white px-2.5 text-sm font-semibold outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-300"
                />
                <button
                  type="submit"
                  aria-label="שמירת השם"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-indigo-600 text-white"
                >
                  <Check size={16} />
                </button>
                <button
                  type="button"
                  aria-label="ביטול"
                  onClick={() => {
                    setEditing(null);
                    setError(null);
                  }}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-500 ring-1 ring-slate-200"
                >
                  <X size={16} />
                </button>
              </form>
            );
          }
          if (confirming === topic) {
            return (
              <div key={topic} className="space-y-1.5 rounded-xl border border-rose-200 bg-rose-50/60 p-2">
                <div className="text-[12px] font-bold text-rose-700">
                  למחוק את "{topic}"?{" "}
                  {count > 0 ? `${count} הרגלים יישארו ללא תחום (ההרגלים עצמם לא יימחקו).` : "אין הרגלים בתחום הזה."}
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      deleteHabitTopic(topic);
                      setConfirming(null);
                    }}
                    className="h-9 flex-1 rounded-lg bg-rose-600 text-[12px] font-extrabold text-white"
                  >
                    מחק תחום
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(null)}
                    className="h-9 flex-1 rounded-lg bg-white text-[12px] font-extrabold text-slate-600 ring-1 ring-slate-200"
                  >
                    ביטול
                  </button>
                </div>
              </div>
            );
          }
          return (
            <div
              key={topic}
              className="flex min-h-11 items-center gap-1 rounded-xl border border-slate-100 bg-white py-1 pe-1 ps-3"
            >
              <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-slate-800">{topic}</span>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-500">
                {count} הרגלים
              </span>
              <button
                type="button"
                disabled={index === 0}
                onClick={() => moveHabitTopic(topic, -1)}
                aria-label={`הזזת ${topic} למעלה`}
                className="grid h-9 w-8 shrink-0 place-items-center text-slate-400 disabled:opacity-25"
              >
                <ChevronUp size={16} />
              </button>
              <button
                type="button"
                disabled={index === habitTopics.length - 1}
                onClick={() => moveHabitTopic(topic, 1)}
                aria-label={`הזזת ${topic} למטה`}
                className="grid h-9 w-8 shrink-0 place-items-center text-slate-400 disabled:opacity-25"
              >
                <ChevronDown size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(topic);
                  setEditDraft(topic);
                  setConfirming(null);
                  setError(null);
                }}
                aria-label={`שינוי שם ${topic}`}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-indigo-500 hover:bg-indigo-50"
              >
                <Pencil size={15} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirming(topic);
                  setEditing(null);
                }}
                aria-label={`מחיקת ${topic}`}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-rose-400 hover:bg-rose-50"
              >
                <Trash2 size={15} />
              </button>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] font-bold leading-relaxed text-slate-400">
        שינוי שם מעדכן אוטומטית את כל ההרגלים בתחום. מחיקת תחום לא מוחקת אף הרגל.
      </p>
    </ViewportModal>
  );
}
