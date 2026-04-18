import type { Task } from "../types";
import { STORAGE_KEYS } from "./constants";

// Tracks which (taskId, event) combinations have already fired so we don't
// re-notify on every tick. Event keys: "morning:<YYYY-MM-DD>", "pre1h", "overdue".
type NotifiedMap = Record<string, true>;

function loadNotified(): NotifiedMap {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.notified) ?? "{}");
  } catch {
    return {};
  }
}

function saveNotified(map: NotifiedMap) {
  localStorage.setItem(STORAGE_KEYS.notified, JSON.stringify(map));
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

function notify(title: string, body: string) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, {
      body,
      icon: "/favicon.svg",
      silent: false,
    });
  } catch (err) {
    console.warn("[taskmaster] notify failed:", err);
  }
}

function todayKey(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Checks all tasks against the user's notification rules and fires any that
 * are due. Idempotent — repeated calls in the same window are no-ops.
 *
 * Rules (chosen by the user):
 *  - Morning digest: once per day, first check after 07:00 local listing
 *    all tasks due that calendar day that aren't done.
 *  - 1 hour before deadline: fire once when we're within the 60-minute
 *    window before the deadline and haven't fired yet.
 */
export function runNotificationCheck(tasks: Task[]) {
  if (Notification.permission !== "granted") return;

  const now = new Date();
  const notified = loadNotified();
  let changed = false;

  // --- Morning digest ------------------------------------------------
  const MORNING_HOUR = 7;
  if (now.getHours() >= MORNING_HOUR) {
    const key = `morning:${todayKey(now)}`;
    if (!notified[key]) {
      const dueToday = tasks.filter((t) => {
        if (t.status === "done" || !t.deadline) return false;
        return isSameDay(new Date(t.deadline), now);
      });
      if (dueToday.length > 0) {
        const body =
          dueToday.length === 1
            ? dueToday[0].title
            : `${dueToday.length} tasks due today:\n` +
              dueToday
                .slice(0, 5)
                .map((t) => `• ${t.title}`)
                .join("\n");
        notify("TASKMASTER — Today's tasks", body);
      }
      notified[key] = true;
      changed = true;
    }
  }

  // --- 1-hour warning ------------------------------------------------
  for (const t of tasks) {
    if (t.status === "done" || !t.deadline) continue;
    const deadline = new Date(t.deadline);
    const msToDeadline = deadline.getTime() - now.getTime();
    const key = `pre1h:${t.id}:${t.deadline}`;
    // Fire when between 0 and 60 minutes away.
    if (msToDeadline > 0 && msToDeadline <= 60 * 60 * 1000) {
      if (!notified[key]) {
        const mins = Math.max(1, Math.round(msToDeadline / 60000));
        notify(
          `Due in ${mins} min — ${t.title}`,
          t.description?.slice(0, 140) || "",
        );
        notified[key] = true;
        changed = true;
      }
    }
  }

  if (changed) saveNotified(notified);
}

/**
 * Clean up old entries so the notified map doesn't grow forever.
 */
export function pruneNotified(tasks: Task[]) {
  const notified = loadNotified();
  const taskIds = new Set(tasks.map((t) => t.id));
  const today = todayKey();
  let changed = false;
  for (const key of Object.keys(notified)) {
    if (key.startsWith("morning:")) {
      if (!key.endsWith(today)) {
        delete notified[key];
        changed = true;
      }
    } else if (key.startsWith("pre1h:")) {
      const [, taskId] = key.split(":");
      if (!taskIds.has(taskId)) {
        delete notified[key];
        changed = true;
      }
    }
  }
  if (changed) saveNotified(notified);
}
