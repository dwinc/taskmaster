import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import type { Category } from "../types";
import { useData } from "../context/DataContext";
import { Modal } from "./Modal";
import { CATEGORY_COLORS, CATEGORY_ICONS } from "../lib/constants";
import { CategoryIcon } from "./CategoryIcon";
import { cx, hexAlpha } from "../lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  category: Category | null;
}

export function CategoryModal({ open, onClose, category }: Props) {
  const { addCategory, updateCategory, deleteCategory, tasks } = useData();
  const [name, setName] = useState("");
  const [color, setColor] = useState(CATEGORY_COLORS[6].value);
  const [icon, setIcon] = useState(CATEGORY_ICONS[0]);

  useEffect(() => {
    if (!open) return;
    if (category) {
      setName(category.name);
      setColor(category.color);
      setIcon(category.icon);
    } else {
      setName("");
      setColor(CATEGORY_COLORS[6].value);
      setIcon(CATEGORY_ICONS[0]);
    }
  }, [open, category]);

  const canSave = name.trim().length > 0;

  const onSave = () => {
    if (!canSave) return;
    if (category) {
      updateCategory(category.id, { name: name.trim(), color, icon });
    } else {
      addCategory({ name, color, icon });
    }
    onClose();
  };

  const onDelete = () => {
    if (!category) return;
    const taskCount = tasks.filter((t) => t.category_id === category.id).length;
    const msg = taskCount
      ? `Delete "${category.name}" and its ${taskCount} task${taskCount === 1 ? "" : "s"}?`
      : `Delete "${category.name}"?`;
    if (confirm(msg)) {
      deleteCategory(category.id);
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={category ? "Edit category" : "New category"}
    >
      <div className="p-6 space-y-5">
        <label className="block">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Name
          </span>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Work, Personal, Health"
            className="tm-input mt-2"
          />
        </label>

        <div>
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Color
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {CATEGORY_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => setColor(c.value)}
                className={cx(
                  "w-10 h-10 rounded-xl transition-transform border-2",
                  color === c.value
                    ? "scale-110 border-neutral-900 dark:border-white"
                    : "border-transparent hover:scale-105",
                )}
                style={{ backgroundColor: c.value }}
                title={c.name}
              />
            ))}
          </div>
        </div>

        <div>
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Icon
          </span>
          <div className="mt-2 grid grid-cols-7 md:grid-cols-10 gap-2">
            {CATEGORY_ICONS.map((name) => {
              const active = name === icon;
              return (
                <button
                  key={name}
                  onClick={() => setIcon(name)}
                  className={cx(
                    "aspect-square rounded-xl flex items-center justify-center border-2 transition-all",
                    active
                      ? "border-transparent"
                      : "border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:border-neutral-300 dark:hover:border-neutral-700",
                  )}
                  style={
                    active
                      ? {
                          backgroundColor: hexAlpha(color, 0.15),
                          color,
                        }
                      : undefined
                  }
                  title={name}
                >
                  <CategoryIcon name={name} className="w-5 h-5" strokeWidth={2.2} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl p-4 flex items-center gap-3" style={{ backgroundColor: hexAlpha(color, 0.08) }}>
          <span
            className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: hexAlpha(color, 0.2), color }}
          >
            <CategoryIcon name={icon} className="w-5 h-5" strokeWidth={2.2} />
          </span>
          <div className="text-base font-semibold text-neutral-900 dark:text-white truncate">
            {name || "Preview"}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/40">
        {category ? (
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
            {category ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
