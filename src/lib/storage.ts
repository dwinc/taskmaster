import type { AppData, Category, Task } from "../types";
import { STORAGE_KEYS } from "./constants";
import { supabase } from "./supabase";
import * as outbox from "./outbox";

const EMPTY: AppData = { categories: [], tasks: [] };

function normalizeTask(t: Task): Task {
  const raw = t as Task & { on_today?: boolean; today_position?: number };
  return {
    ...t,
    on_today: !!raw.on_today,
    today_position:
      typeof raw.today_position === "number" ? raw.today_position : 0,
    tags: Array.isArray(t.tags) ? t.tags : [],
    subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
  };
}

export function loadLocal(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.data);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as AppData;
    return {
      categories: parsed.categories ?? [],
      tasks: (parsed.tasks ?? []).map(normalizeTask),
    };
  } catch {
    return EMPTY;
  }
}

export function saveLocal(data: AppData) {
  localStorage.setItem(STORAGE_KEYS.data, JSON.stringify(data));
}

// ---- Merge ---------------------------------------------------------
//
// Combines local and remote snapshots safely:
//
//   - Items in remote only  -> keep (came from another session / device).
//   - Items in local only   -> keep IF outbox has a pending upsert for them
//                              (unsynced work). Drop otherwise (they were
//                              deleted remotely).
//   - Items in both         -> tasks: newer updated_at wins.
//                              categories: remote wins (no updated_at field).
//   - Items with a pending delete -> removed from the result (even if remote
//                                    still has them; our delete just hasn't
//                                    landed yet).
//
// This fixes the overwrite bug where refreshing wiped locally-created items
// that hadn't synced yet.
//
export function mergeSnapshots(local: AppData, remote: AppData): AppData {
  const pendingUpserts = outbox.pendingUpsertIds();
  const pendingDeletes = outbox.pendingDeleteIds();

  // --- Tasks ---
  const taskById = new Map<string, Task>();
  for (const t of remote.tasks) taskById.set(t.id, normalizeTask(t));

  for (const t of local.tasks) {
    const normalized = normalizeTask(t);
    const remoteT = taskById.get(t.id);
    if (!remoteT) {
      // Only present locally — keep ONLY if unsynced.
      if (pendingUpserts.tasks.has(t.id)) {
        taskById.set(t.id, normalized);
      }
      continue;
    }
    // Present in both: take newer by updated_at.
    const localTime = new Date(normalized.updated_at).getTime();
    const remoteTime = new Date(remoteT.updated_at).getTime();
    if (localTime > remoteTime) taskById.set(t.id, normalized);
  }
  // Strip anything we have a pending delete for.
  for (const id of pendingDeletes.tasks) taskById.delete(id);

  // --- Categories ---
  const catById = new Map<string, Category>();
  for (const c of remote.categories) catById.set(c.id, c);

  for (const c of local.categories) {
    const remoteC = catById.get(c.id);
    if (!remoteC) {
      if (pendingUpserts.categories.has(c.id)) catById.set(c.id, c);
      continue;
    }
    // No updated_at on categories — but if we have a pending upsert for this
    // id, our local copy is the authoritative one.
    if (pendingUpserts.categories.has(c.id)) catById.set(c.id, c);
  }
  for (const id of pendingDeletes.categories) catById.delete(id);

  return {
    categories: Array.from(catById.values()),
    tasks: Array.from(taskById.values()),
  };
}

// ---- Supabase sync -------------------------------------------------

export async function fetchRemote(): Promise<AppData | null> {
  try {
    const [catRes, taskRes] = await Promise.all([
      supabase.from("categories").select("*"),
      supabase.from("tasks").select("*"),
    ]);
    if (catRes.error) throw catRes.error;
    if (taskRes.error) throw taskRes.error;
    return {
      categories: (catRes.data ?? []) as Category[],
      tasks: ((taskRes.data ?? []) as Task[]).map(normalizeTask),
    };
  } catch (err) {
    console.warn("[taskmaster] fetchRemote failed:", err);
    return null;
  }
}

// Each write goes through the outbox: enqueue first, attempt the remote call,
// and only remove from the outbox on success. If the call fails, the op stays
// queued for retry.

export async function upsertCategoryRemote(category: Category): Promise<boolean> {
  const op: outbox.PendingOp = { kind: "upsert_category", payload: category };
  outbox.enqueue(op);
  try {
    const { error } = await supabase.from("categories").upsert(category);
    if (error) throw error;
    outbox.remove(op);
    return true;
  } catch (err) {
    console.warn("[taskmaster] upsertCategoryRemote failed:", err);
    return false;
  }
}

export async function deleteCategoryRemote(id: string): Promise<boolean> {
  const op: outbox.PendingOp = { kind: "delete_category", id };
  outbox.enqueue(op);
  try {
    // Tasks cascade via FK (see supabase-schema.sql); also delete locally.
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) throw error;
    outbox.remove(op);
    return true;
  } catch (err) {
    console.warn("[taskmaster] deleteCategoryRemote failed:", err);
    return false;
  }
}

export async function upsertTaskRemote(task: Task): Promise<boolean> {
  const op: outbox.PendingOp = { kind: "upsert_task", payload: task };
  outbox.enqueue(op);
  try {
    const { error } = await supabase.from("tasks").upsert(task);
    if (error) throw error;
    outbox.remove(op);
    return true;
  } catch (err) {
    console.warn("[taskmaster] upsertTaskRemote failed:", err);
    return false;
  }
}

export async function deleteTaskRemote(id: string): Promise<boolean> {
  const op: outbox.PendingOp = { kind: "delete_task", id };
  outbox.enqueue(op);
  try {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) throw error;
    outbox.remove(op);
    return true;
  } catch (err) {
    console.warn("[taskmaster] deleteTaskRemote failed:", err);
    return false;
  }
}

/** Drain the outbox — attempt each pending op, remove on success.
 *  Returns the number of ops still pending after the attempt. */
export async function flushOutbox(): Promise<number> {
  const ops = outbox.readAll();
  for (const op of ops) {
    try {
      if (op.kind === "upsert_task") {
        const { error } = await supabase.from("tasks").upsert(op.payload);
        if (error) throw error;
      } else if (op.kind === "upsert_category") {
        const { error } = await supabase.from("categories").upsert(op.payload);
        if (error) throw error;
      } else if (op.kind === "delete_task") {
        const { error } = await supabase.from("tasks").delete().eq("id", op.id);
        if (error) throw error;
      } else if (op.kind === "delete_category") {
        const { error } = await supabase.from("categories").delete().eq("id", op.id);
        if (error) throw error;
      }
      outbox.remove(op);
    } catch (err) {
      console.warn("[taskmaster] flushOutbox: op failed, will retry later", op.kind, err);
      // Stop on first failure — no point hammering if the first one fails.
      break;
    }
  }
  return outbox.size();
}

export function pendingWritesCount(): number {
  return outbox.size();
}
