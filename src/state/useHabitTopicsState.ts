import { useCallback, useMemo } from "react";
import {
  addHabitTopic as addTopic,
  deleteHabitTopic as deleteTopic,
  habitTopicList,
  moveHabitTopic as moveTopic,
  renameHabitTopic as renameTopic,
  type TopicEdit,
} from "../lib/habitTopics";
import { syncHabitTopics } from "../lib/supabase";
import type { Bubble, HabitTopicsSetting } from "../types";
import type { Store } from "./store";

export interface HabitTopicsState {
  /** The effective catalog (starter suggestions until the list is first edited). */
  habitTopics: string[];
  /** Each returns an error message, or null on success. */
  addHabitTopic: (name: string) => string | null;
  renameHabitTopic: (from: string, to: string) => string | null;
  /** Removes the topic and clears it from its habits; the habits are never deleted. */
  deleteHabitTopic: (name: string) => string | null;
  moveHabitTopic: (name: string, direction: -1 | 1) => void;
}

/** CRUD on the `habit_topics` setting; renames and deletes re-stamp the affected habits' extras. */
export function useHabitTopicsState(store: Store): HabitTopicsState {
  const { snapshot, snapshotRef, commit, scheduleExtrasSync } = store;

  const apply = useCallback(
    (edit: (setting: HabitTopicsSetting | undefined, bubbles: Bubble[], now: number) => TopicEdit<Bubble>) => {
      const prev = snapshotRef.current;
      const result = edit(prev.habitTopics, prev.bubbles, Date.now());
      if (!result.ok) return result.error;
      commit({
        ...prev,
        habitTopics: result.setting,
        bubbles: result.changedIds.length ? result.bubbles : prev.bubbles,
      });
      void syncHabitTopics(result.setting);
      if (result.changedIds.length) scheduleExtrasSync();
      return null;
    },
    [commit, scheduleExtrasSync, snapshotRef],
  );

  const addHabitTopic = useCallback(
    (name: string) => apply((setting, bubbles, now) => addTopic(setting, bubbles, name, now)),
    [apply],
  );
  const renameHabitTopic = useCallback(
    (from: string, to: string) => apply((setting, bubbles, now) => renameTopic(setting, bubbles, from, to, now)),
    [apply],
  );
  const deleteHabitTopic = useCallback(
    (name: string) => apply((setting, bubbles, now) => deleteTopic(setting, bubbles, name, now)),
    [apply],
  );
  const moveHabitTopic = useCallback(
    (name: string, direction: -1 | 1) => {
      apply((setting, bubbles, now) => moveTopic(setting, bubbles, name, direction, now));
    },
    [apply],
  );

  const habitTopics = useMemo(() => habitTopicList(snapshot.habitTopics), [snapshot.habitTopics]);

  return useMemo(
    () => ({ habitTopics, addHabitTopic, renameHabitTopic, deleteHabitTopic, moveHabitTopic }),
    [addHabitTopic, deleteHabitTopic, habitTopics, moveHabitTopic, renameHabitTopic],
  );
}
