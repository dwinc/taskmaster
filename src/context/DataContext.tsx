import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AppData, Category, Subtask, Task, TaskStatus } from "../types";
import {
  deleteCategoryRemote,
  deleteTaskRemote,
  fetchRemote,
  flushOutbox,
  loadLocal,
  mergeSnapshots,
  pendingWritesCount,
  saveLocal,
  upsertCategoryRemote,
  upsertTaskRemote,
} from "../lib/storage";
import { uuid } from "../lib/utils";
import {
  pruneNotified,
  runNotificationCheck,
} from "../lib/notifications";
import { useAuth } from "./AuthContext";

interface DataValue {
  categories: Category[];
  tasks: Task[];
  loading: boolean;
  syncing: boolean;
  lastSyncError: string | null;
  pendingWrites: number;

  addCategory: (input: {
    name: string;
    color: string;
    icon: string;
  }) => Category;
  updateCategory: (
    id: string,
    patch: Partial<Pick<Category, "name" | "color" | "icon" | "position">>,
  ) => void;
  deleteCategory: (id: string) => void;
  reorderCategories: (idsInOrder: string[]) => void;

  addTask: (input: {
    category_id: string;
    title: string;
    description?: string;
    deadline?: string | null;
    tags?: string[];
    subtasks?: Subtask[];
  }) => Task;
  updateTask: (
    id: string,
    patch: Partial<
      Pick<
        Task,
        | "title"
        | "description"
        | "status"
        | "deadline"
        | "category_id"
        | "position"
        | "tags"
        | "subtasks"
      >
    >,
  ) => void;
  deleteTask: (id: string) => void;
  toggleTaskDone: (id: string) => void;
  reorderTasks: (categoryId: string, idsInOrder: string[]) => void;

  forceSync: () => Promise<void>;
}

const DataContext = createContext<DataValue | null>(null);

const now = () => new Date().toISOString();

export function DataProvider({ children }: { children: ReactNode }) {
  const { authed, user, isAdmin, allowedCategoryIds } = useAuth();
  const taskOwnerName = user?.displayName ?? "User";
  const [data, setData] = useState<AppData>({ categories: [], tasks: [] });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const [pendingWrites, setPendingWrites] = useState<number>(pendingWritesCount());
  const dataRef = useRef(data);
  dataRef.current = data;

  // Called after any remote attempt to reflect the current outbox size.
  const refreshPending = useCallback(() => {
    setPendingWrites(pendingWritesCount());
  }, []);

  // Fire-and-forget: wraps a remote promise, then refreshes the pending
  // count and opportunistically drains anything still queued. Retry only
  // piggybacks on successful mutations — no polling.
  const trackWrite = useCallback(
    (p: Promise<boolean>) => {
      void p.then(async (ok) => {
        if (ok && pendingWritesCount() > 0) {
          await flushOutbox();
        }
        refreshPending();
      });
    },
    [refreshPending],
  );

  // Persist to localStorage whenever data changes.
  useEffect(() => {
    saveLocal(data);
  }, [data]);

  // Initial load: localStorage first (instant), then merge with Supabase.
  // The merge preserves any locally-created items still sitting in the
  // outbox, so a refresh before sync completes cannot lose data.
  useEffect(() => {
    if (!authed) return;
    const local = loadLocal();
    setData(local);
    setLoading(false);

    (async () => {
      setSyncing(true);
      // Drain anything left in the outbox from a previous session first, so
      // the remote snapshot we fetch next reflects our pending work.
      if (pendingWritesCount() > 0) {
        await flushOutbox();
      }
      const remote = await fetchRemote();
      if (remote) {
        setData((current) => mergeSnapshots(current, remote));
        setLastSyncError(null);
      } else {
        setLastSyncError("Offline — using local data");
      }
      refreshPending();
      setSyncing(false);
    })();
  }, [authed, refreshPending]);

  // Notification loop: check every minute.
  useEffect(() => {
    if (!authed) return;
    const tick = () => {
      runNotificationCheck(dataRef.current.tasks);
      pruneNotified(dataRef.current.tasks);
    };
    tick();
    const id = window.setInterval(tick, 60 * 1000);
    return () => window.clearInterval(id);
  }, [authed]);

  // Periodic remote pull: every 60 seconds, merge in any remote changes.
  // Skips when the tab is hidden or a sync is already in flight, and also
  // fires immediately when the tab becomes visible again so we catch up.
  useEffect(() => {
    if (!authed) return;
    const syncingRef = { current: false };
    const pull = async () => {
      if (document.hidden) return;
      if (syncingRef.current) return;
      syncingRef.current = true;
      try {
        if (pendingWritesCount() > 0) await flushOutbox();
        const remote = await fetchRemote();
        if (remote) {
          setData((current) => mergeSnapshots(current, remote));
          setLastSyncError(null);
        }
        refreshPending();
      } finally {
        syncingRef.current = false;
      }
    };
    const id = window.setInterval(() => void pull(), 60 * 1000);
    const onVisibility = () => {
      if (!document.hidden) void pull();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [authed, refreshPending]);

  // --- Category CRUD -------------------------------------------------

  const addCategory: DataValue["addCategory"] = useCallback(
    (input) => {
      if (!isAdmin) {
        throw new Error("Only admins can create categories");
      }
      const cat: Category = {
        id: uuid(),
        name: input.name.trim(),
        color: input.color,
        icon: input.icon,
        position: dataRef.current.categories.length,
        user_name: taskOwnerName,
        created_at: now(),
      };
      setData((d) => ({ ...d, categories: [...d.categories, cat] }));
      trackWrite(upsertCategoryRemote(cat));
      return cat;
    },
    [isAdmin, taskOwnerName, trackWrite],
  );

  const updateCategory: DataValue["updateCategory"] = useCallback(
    (id, patch) => {
      if (!isAdmin) {
        console.warn("[taskmaster] updateCategory denied: admin only");
        return;
      }
      setData((d) => {
        const categories = d.categories.map((c) =>
          c.id === id ? { ...c, ...patch } : c,
        );
        const changed = categories.find((c) => c.id === id);
        if (changed) trackWrite(upsertCategoryRemote(changed));
        return { ...d, categories };
      });
    },
    [isAdmin, trackWrite],
  );

  const deleteCategory: DataValue["deleteCategory"] = useCallback(
    (id) => {
      if (!isAdmin) {
        console.warn("[taskmaster] deleteCategory denied: admin only");
        return;
      }
      setData((d) => ({
        categories: d.categories.filter((c) => c.id !== id),
        tasks: d.tasks.filter((t) => t.category_id !== id),
      }));
      trackWrite(deleteCategoryRemote(id));
    },
    [isAdmin, trackWrite],
  );

  const reorderCategories: DataValue["reorderCategories"] = useCallback(
    (idsInOrder) => {
      if (!isAdmin) {
        console.warn("[taskmaster] reorderCategories denied: admin only");
        return;
      }
      setData((d) => {
        const byId = new Map(d.categories.map((c) => [c.id, c]));
        const reordered: Category[] = [];
        idsInOrder.forEach((id, i) => {
          const c = byId.get(id);
          if (!c) return;
          if (c.position === i) {
            reordered.push(c);
          } else {
            const updated = { ...c, position: i };
            reordered.push(updated);
            // Only upsert rows whose position actually changed.
            trackWrite(upsertCategoryRemote(updated));
          }
        });
        return { ...d, categories: reordered };
      });
    },
    [isAdmin, trackWrite],
  );

  // --- Task CRUD -----------------------------------------------------

  const addTask: DataValue["addTask"] = useCallback(
    (input) => {
      if (
        allowedCategoryIds &&
        !allowedCategoryIds.has(input.category_id)
      ) {
        console.warn("[taskmaster] addTask denied: category not allowed");
        throw new Error("You cannot add tasks to this category");
      }
      const existingInCat = dataRef.current.tasks.filter(
        (t) => t.category_id === input.category_id,
      );
      const task: Task = {
        id: uuid(),
        category_id: input.category_id,
        title: input.title.trim(),
        description: input.description?.trim() ?? "",
        status: "not_done",
        deadline: input.deadline ?? null,
        position: existingInCat.length,
        user_name: taskOwnerName,
        created_at: now(),
        updated_at: now(),
        completed_at: null,
        tags: input.tags ?? [],
        subtasks: input.subtasks ?? [],
      };
      setData((d) => ({ ...d, tasks: [...d.tasks, task] }));
      trackWrite(upsertTaskRemote(task));
      return task;
    },
    [allowedCategoryIds, taskOwnerName, trackWrite],
  );

  const updateTask: DataValue["updateTask"] = useCallback(
    (id, patch) => {
      setData((d) => {
        const prev = d.tasks.find((t) => t.id === id);
        const nextCat = patch.category_id ?? prev?.category_id;
        if (
          allowedCategoryIds &&
          nextCat &&
          !allowedCategoryIds.has(nextCat)
        ) {
          console.warn("[taskmaster] updateTask denied: category not allowed");
          return d;
        }
        const tasks = d.tasks.map((t) => {
          if (t.id !== id) return t;
          const next: Task = {
            ...t,
            ...patch,
            updated_at: now(),
          };
          if (patch.status) {
            next.completed_at = patch.status === "done" ? now() : null;
          }
          return next;
        });
        const changed = tasks.find((t) => t.id === id);
        if (changed) trackWrite(upsertTaskRemote(changed));
        return { ...d, tasks };
      });
    },
    [allowedCategoryIds, trackWrite],
  );

  const deleteTask: DataValue["deleteTask"] = useCallback(
    (id) => {
      let removed = false;
      setData((d) => {
        const target = d.tasks.find((t) => t.id === id);
        if (
          allowedCategoryIds &&
          target &&
          !allowedCategoryIds.has(target.category_id)
        ) {
          console.warn("[taskmaster] deleteTask denied: category not allowed");
          return d;
        }
        removed = true;
        return {
          ...d,
          tasks: d.tasks.filter((t) => t.id !== id),
        };
      });
      if (removed) trackWrite(deleteTaskRemote(id));
    },
    [allowedCategoryIds, trackWrite],
  );

  const toggleTaskDone: DataValue["toggleTaskDone"] = useCallback(
    (id) => {
      setData((d) => {
        const prev = d.tasks.find((t) => t.id === id);
        if (
          allowedCategoryIds &&
          prev &&
          !allowedCategoryIds.has(prev.category_id)
        ) {
          return d;
        }
        const tasks = d.tasks.map((t) => {
          if (t.id !== id) return t;
          const nextStatus: TaskStatus = t.status === "done" ? "not_done" : "done";
          const next: Task = {
            ...t,
            status: nextStatus,
            completed_at: nextStatus === "done" ? now() : null,
            updated_at: now(),
          };
          return next;
        });
        const changed = tasks.find((t) => t.id === id);
        if (changed) trackWrite(upsertTaskRemote(changed));
        return { ...d, tasks };
      });
    },
    [allowedCategoryIds, trackWrite],
  );

  const reorderTasks: DataValue["reorderTasks"] = useCallback(
    (categoryId, idsInOrder) => {
      if (
        allowedCategoryIds &&
        !allowedCategoryIds.has(categoryId)
      ) {
        return;
      }
      setData((d) => {
        const byId = new Map(d.tasks.map((t) => [t.id, t]));
        idsInOrder.forEach((id, i) => {
          const t = byId.get(id);
          if (!t || t.category_id !== categoryId) return;
          if (t.position === i) return;
          const updated = { ...t, position: i, updated_at: now() };
          byId.set(id, updated);
          // Only upsert rows whose position actually changed.
          trackWrite(upsertTaskRemote(updated));
        });
        return { ...d, tasks: Array.from(byId.values()) };
      });
    },
    [allowedCategoryIds, trackWrite],
  );

  const forceSync = useCallback(async () => {
    setSyncing(true);
    if (pendingWritesCount() > 0) {
      await flushOutbox();
    }
    const remote = await fetchRemote();
    if (remote) {
      setData((current) => mergeSnapshots(current, remote));
      setLastSyncError(null);
    } else {
      setLastSyncError("Sync failed");
    }
    refreshPending();
    setSyncing(false);
  }, [refreshPending]);

  const value = useMemo<DataValue>(
    () => ({
      categories: data.categories,
      tasks: data.tasks,
      loading,
      syncing,
      lastSyncError,
      pendingWrites,
      addCategory,
      updateCategory,
      deleteCategory,
      reorderCategories,
      addTask,
      updateTask,
      deleteTask,
      toggleTaskDone,
      reorderTasks,
      forceSync,
    }),
    [
      data,
      loading,
      syncing,
      lastSyncError,
      pendingWrites,
      addCategory,
      updateCategory,
      deleteCategory,
      reorderCategories,
      addTask,
      updateTask,
      deleteTask,
      toggleTaskDone,
      reorderTasks,
      forceSync,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
