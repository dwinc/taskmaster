import { useEffect, useMemo, useState } from "react";
import { ListChecks, Settings2, Trash2, X } from "lucide-react";
import type { Subtask, Task, TaskStatus } from "../types";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { Modal } from "./Modal";
import { STATUS_META } from "../lib/constants";
import { cx, hexAlpha, normalizeTag, tagColor, uuid } from "../lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  task: Task | null; // null = creating
  defaultCategoryId?: string;
}

type Tab = "details" | "subtasks";

// Convert an ISO string to a value compatible with datetime-local inputs.
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(input: string): string | null {
  if (!input) return null;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

const STATUS_OPTIONS: TaskStatus[] = ["not_done", "in_progress", "blocked", "done"];

export function TaskModal({ open, onClose, task, defaultCategoryId }: Props) {
  const { isAdmin, allowedCategoryIds } = useAuth();
  const { categories, addTask, updateTask, deleteTask } = useData();

  const selectableCategories = useMemo(() => {
    if (isAdmin || !allowedCategoryIds) return categories;
    const allowed = categories.filter((c) => allowedCategoryIds.has(c.id));
    if (task) {
      const cur = categories.find((c) => c.id === task.category_id);
      if (cur && !allowed.some((c) => c.id === cur.id)) {
        return [...allowed, cur];
      }
    }
    return allowed;
  }, [categories, isAdmin, allowedCategoryIds, task]);

  const [tab, setTab] = useState<Tab>("details");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("not_done");
  const [deadline, setDeadline] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [subtaskInput, setSubtaskInput] = useState("");

  useEffect(() => {
    if (!open) return;
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setStatus(task.status);
      setDeadline(isoToLocalInput(task.deadline));
      setCategoryId(task.category_id);
      setTags(task.tags ?? []);
      setSubtasks(task.subtasks ?? []);
    } else {
      setTitle("");
      setDescription("");
      setStatus("not_done");
      setDeadline("");
      setCategoryId(
        defaultCategoryId ??
          selectableCategories[0]?.id ??
          categories[0]?.id ??
          "",
      );
      setTags([]);
      setSubtasks([]);
    }
    setTagInput("");
    setSubtaskInput("");
    setTab("details");
    // Intentionally omit categories / selectableCategories: they get new
    // references on every remote merge; re-running would wipe in-progress new tasks.
  }, [open, task, defaultCategoryId]);

  // Categories may load after the modal opens — set a default once if still empty.
  useEffect(() => {
    if (!open || task) return;
    if (categoryId) return;
    const fallback =
      defaultCategoryId ??
      selectableCategories[0]?.id ??
      categories[0]?.id;
    if (fallback) setCategoryId(fallback);
  }, [
    open,
    task,
    categoryId,
    defaultCategoryId,
    selectableCategories,
    categories,
  ]);

  // --- Tag helpers ---------------------------------------------------
  const addTag = (raw: string) => {
    const t = normalizeTag(raw);
    if (!t) return;
    setTags((cur) => (cur.includes(t) ? cur : [...cur, t]));
    setTagInput("");
  };
  const removeTag = (t: string) => setTags((cur) => cur.filter((x) => x !== t));
  const onTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  // --- Subtask helpers -----------------------------------------------
  const addSubtask = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    setSubtasks((cur) => [...cur, { id: uuid(), title: t, done: false }]);
    setSubtaskInput("");
  };
  const toggleSubtask = (id: string) => {
    setSubtasks((cur) =>
      cur.map((s) => (s.id === id ? { ...s, done: !s.done } : s)),
    );
  };
  const updateSubtaskTitle = (id: string, title: string) => {
    setSubtasks((cur) => cur.map((s) => (s.id === id ? { ...s, title } : s)));
  };
  const removeSubtask = (id: string) => {
    setSubtasks((cur) => cur.filter((s) => s.id !== id));
  };
  const onSubtaskInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addSubtask(subtaskInput);
    }
  };

  const canSave = title.trim().length > 0 && categoryId;

  const onSave = () => {
    if (!canSave) return;
    const iso = localInputToIso(deadline);
    // Commit any half-typed tag / subtask before saving so users don't lose it.
    const finalTags = tagInput.trim()
      ? Array.from(new Set([...tags, normalizeTag(tagInput)])).filter(Boolean)
      : tags;
    const finalSubtasks = subtaskInput.trim()
      ? [...subtasks, { id: uuid(), title: subtaskInput.trim(), done: false }]
      : subtasks;

    try {
      if (task) {
        updateTask(task.id, {
          title: title.trim(),
          description: description.trim(),
          status,
          deadline: iso,
          category_id: categoryId,
          tags: finalTags,
          subtasks: finalSubtasks,
        });
      } else {
        const created = addTask({
          category_id: categoryId,
          title,
          description,
          deadline: iso,
          tags: finalTags,
          subtasks: finalSubtasks,
        });
        if (status !== "not_done") {
          updateTask(created.id, { status });
        }
      }
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not save task");
    }
  };

  const onDelete = () => {
    if (!task) return;
    if (confirm(`Delete "${task.title}"?`)) {
      deleteTask(task.id);
      onClose();
    }
  };

  const selectedCat = useMemo(
    () => categories.find((c) => c.id === categoryId),
    [categories, categoryId],
  );

  const categoryPickerDisabled =
    !task && selectableCategories.length === 0;

  const doneSubtasks = subtasks.filter((s) => s.done).length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task ? "Edit task" : "New task"}
    >
      {/* Title is always visible — it's the one mandatory field. */}
      <div className="px-6 pt-6 pb-4">
        <input
          autoFocus
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs to be done?"
          className="tm-input !text-lg !font-semibold"
        />
      </div>

      {/* Tabs */}
      <div className="px-6 pb-3">
        <div className="flex rounded-xl bg-neutral-100 dark:bg-neutral-900 p-1">
          <button
            onClick={() => setTab("details")}
            className={cx(
              "flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2",
              tab === "details"
                ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white"
                : "text-neutral-500 dark:text-neutral-400",
            )}
          >
            <Settings2 className="w-4 h-4" /> Details
          </button>
          <button
            onClick={() => setTab("subtasks")}
            className={cx(
              "flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2",
              tab === "subtasks"
                ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white"
                : "text-neutral-500 dark:text-neutral-400",
            )}
          >
            <ListChecks className="w-4 h-4" />
            Subtasks
            {subtasks.length > 0 && (
              <span className="text-xs font-semibold rounded-full px-1.5 py-0.5 bg-neutral-200 dark:bg-neutral-700">
                {doneSubtasks}/{subtasks.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tab body — constrained height so the modal fits on smaller screens. */}
      <div className="px-6 pb-6 max-h-[55vh] overflow-y-auto">
        {tab === "details" ? (
          <div className="space-y-5">
            <label className="block">
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Description
              </span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional details"
                rows={3}
                className="tm-input mt-2 resize-none"
              />
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <label className="block">
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Category
                </span>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  disabled={categoryPickerDisabled}
                  className="tm-input mt-2"
                  style={
                    selectedCat
                      ? {
                          borderColor: hexAlpha(selectedCat.color, 0.4),
                        }
                      : undefined
                  }
                >
                  {selectableCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Deadline
                </span>
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="tm-input mt-2"
                />
              </label>
            </div>

            <div>
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Tags
              </span>
              <div className="tm-input mt-2 flex flex-wrap items-center gap-1.5 !py-2">
                {tags.map((t) => {
                  const color = tagColor(t);
                  return (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 rounded-full pl-2.5 pr-1 py-0.5 text-[11px] font-semibold tracking-wide uppercase"
                      style={{
                        backgroundColor: hexAlpha(color, 0.15),
                        color,
                      }}
                    >
                      {t}
                      <button
                        type="button"
                        onClick={() => removeTag(t)}
                        className="rounded-full hover:bg-black/10 dark:hover:bg-white/10 p-0.5"
                        aria-label={`Remove ${t}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={onTagKeyDown}
                  onBlur={() => tagInput && addTag(tagInput)}
                  placeholder={tags.length ? "" : "URGENT, EMAIL…"}
                  className="flex-1 min-w-[8ch] bg-transparent outline-none text-sm py-0.5"
                />
              </div>
            </div>

            <div>
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Status
              </span>
              <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                {STATUS_OPTIONS.map((s) => {
                  const meta = STATUS_META[s];
                  const active = s === status;
                  return (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className={cx(
                        "rounded-xl px-3 py-2.5 text-sm font-medium border transition-all",
                        active
                          ? "border-transparent"
                          : "border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700",
                      )}
                      style={
                        active
                          ? {
                              backgroundColor: hexAlpha(meta.color, 0.15),
                              color: meta.color,
                            }
                          : undefined
                      }
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {subtasks.length === 0 && (
              <p className="text-sm text-neutral-500 dark:text-neutral-500 py-2">
                Break this task into smaller one-liners.
              </p>
            )}
            {subtasks.map((s) => (
              <div
                key={s.id}
                className="group flex items-center gap-3 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-900 px-2 py-1.5"
              >
                <button
                  type="button"
                  onClick={() => toggleSubtask(s.id)}
                  className="tm-check flex-shrink-0"
                  data-checked={s.done}
                  aria-label="Toggle subtask"
                >
                  {s.done && (
                    <svg
                      viewBox="0 0 20 20"
                      className="w-3.5 h-3.5 text-white"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 10.5l4 4 8-9" />
                    </svg>
                  )}
                </button>
                <input
                  type="text"
                  value={s.title}
                  onChange={(e) => updateSubtaskTitle(s.id, e.target.value)}
                  className={cx(
                    "flex-1 bg-transparent outline-none text-sm",
                    s.done && "line-through text-neutral-500",
                  )}
                />
                <button
                  type="button"
                  onClick={() => removeSubtask(s.id)}
                  className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-500 p-1"
                  aria-label="Remove subtask"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-3 px-2 pt-1">
              <span className="tm-check flex-shrink-0 opacity-40" aria-hidden />
              <input
                type="text"
                value={subtaskInput}
                onChange={(e) => setSubtaskInput(e.target.value)}
                onKeyDown={onSubtaskInputKeyDown}
                onBlur={() => subtaskInput && addSubtask(subtaskInput)}
                placeholder="Add a subtask…"
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
              />
            </div>
            <p className="pt-2 text-xs text-neutral-500 dark:text-neutral-500 px-2">
              Press Enter to add. Subtasks save with the task.
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/40">
        {task ? (
          <button
            onClick={onDelete}
            className="tm-btn-ghost !text-red-500 hover:!bg-red-500/10"
          >
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="tm-btn-subtle">
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!canSave}
            className="tm-btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {task ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
