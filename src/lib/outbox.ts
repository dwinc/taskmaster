/**
 * Outbox: a durable queue of pending remote writes.
 *
 * Every mutation (upsert / delete) records an op here *before* attempting the
 * remote call. On success the op is removed. On failure it stays — to be
 * retried next time something succeeds, or on app boot.
 *
 * This guarantees local-first durability: if Supabase is unreachable or the
 * call fails for any reason, the intent survives a browser refresh and will
 * eventually reach the server.
 *
 * It also gives us a way to merge local+remote safely on load: any locally
 * present entity that is ALSO in the outbox is "unsynced" and must be kept
 * on merge, even if it's absent from the remote response.
 */
import type { Category, Task } from "../types";

export type PendingOp =
  | { kind: "upsert_task"; payload: Task }
  | { kind: "upsert_category"; payload: Category }
  | { kind: "delete_task"; id: string }
  | { kind: "delete_category"; id: string };

const KEY = "tm_outbox";

function read(): PendingOp[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingOp[]) : [];
  } catch {
    return [];
  }
}

function write(ops: PendingOp[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ops));
  } catch (err) {
    console.warn("[taskmaster] outbox write failed:", err);
  }
}

function keyOf(op: PendingOp): string {
  if (op.kind === "upsert_task" || op.kind === "delete_task") {
    return `task:${op.kind === "upsert_task" ? op.payload.id : op.id}`;
  }
  return `category:${op.kind === "upsert_category" ? op.payload.id : op.id}`;
}

/** Enqueue an op; collapses prior ops for the same entity (latest wins). */
export function enqueue(op: PendingOp) {
  const key = keyOf(op);
  const next = read().filter((existing) => keyOf(existing) !== key);
  next.push(op);
  write(next);
}

/** Remove a specific op from the outbox. */
export function remove(op: PendingOp) {
  const key = keyOf(op);
  // Only remove if the op still matches — a newer op for the same key
  // supersedes and must stay.
  const current = read();
  const idx = current.findIndex((o) => keyOf(o) === key && sameOp(o, op));
  if (idx < 0) return;
  current.splice(idx, 1);
  write(current);
}

function sameOp(a: PendingOp, b: PendingOp): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "delete_task" && b.kind === "delete_task") return a.id === b.id;
  if (a.kind === "delete_category" && b.kind === "delete_category") return a.id === b.id;
  if (a.kind === "upsert_task" && b.kind === "upsert_task") {
    return a.payload.id === b.payload.id && a.payload.updated_at === b.payload.updated_at;
  }
  if (a.kind === "upsert_category" && b.kind === "upsert_category") {
    return a.payload.id === b.payload.id;
  }
  return false;
}

export function readAll(): PendingOp[] {
  return read();
}

export function size(): number {
  return read().length;
}

/** Ids of entities with a pending upsert — used by the merge logic to
 *  preserve locally-created items that haven't synced yet. */
export function pendingUpsertIds(): { tasks: Set<string>; categories: Set<string> } {
  const tasks = new Set<string>();
  const categories = new Set<string>();
  for (const op of read()) {
    if (op.kind === "upsert_task") tasks.add(op.payload.id);
    else if (op.kind === "upsert_category") categories.add(op.payload.id);
  }
  return { tasks, categories };
}

/** Ids of entities with a pending delete — they should NOT be resurrected
 *  by remote data on merge. */
export function pendingDeleteIds(): { tasks: Set<string>; categories: Set<string> } {
  const tasks = new Set<string>();
  const categories = new Set<string>();
  for (const op of read()) {
    if (op.kind === "delete_task") tasks.add(op.id);
    else if (op.kind === "delete_category") categories.add(op.id);
  }
  return { tasks, categories };
}

export function clear() {
  write([]);
}
