import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { GripVertical, MoreHorizontal, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import type { Category, Task } from "../types";
import { useData } from "../context/DataContext";
import { CategoryIcon } from "./CategoryIcon";
import { SortableTaskCard } from "./SortableTaskCard";
import { cx, hexAlpha } from "../lib/utils";

interface Props {
  category: Category;
  tasks: Task[];
  onOpenTask: (task: Task) => void;
  onEditCategory: (category: Category) => void;
  onQuickAddTask: (categoryId: string) => void;
  canEditCategory?: boolean;
  // Optional sortable wiring — provided when the category itself is draggable.
  sortableRef?: (node: HTMLElement | null) => void;
  sortableStyle?: React.CSSProperties;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  dragging?: boolean;
}

export function CategorySection({
  category,
  tasks,
  onOpenTask,
  onEditCategory,
  onQuickAddTask,
  canEditCategory = true,
  sortableRef,
  sortableStyle,
  dragHandleProps,
  dragging,
}: Props) {
  const { reorderTasks, toggleTaskDone } = useData();
  const [menuOpen, setMenuOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Sort: by position then deadline then created
  const ordered = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position;
      const ad = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const bd = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      if (ad !== bd) return ad - bd;
      return a.created_at.localeCompare(b.created_at);
    });
  }, [tasks]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ordered.findIndex((t) => t.id === active.id);
    const newIndex = ordered.findIndex((t) => t.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(ordered, oldIndex, newIndex);
    reorderTasks(
      category.id,
      next.map((t) => t.id),
    );
  };

  return (
    <section
      ref={sortableRef}
      style={sortableStyle}
      className={cx("mb-10", dragging && "opacity-60")}
    >
      {/* Heading */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-3 min-w-0">
          {dragHandleProps && (
            <button
              {...dragHandleProps}
              className="flex-shrink-0 text-neutral-300 dark:text-neutral-700 hover:text-neutral-500 dark:hover:text-neutral-400 touch-none -ml-2"
              aria-label="Drag category"
              title="Drag to reorder"
            >
              <GripVertical className="w-5 h-5" />
            </button>
          )}
          <span
            className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              backgroundColor: hexAlpha(category.color, 0.15),
              color: category.color,
            }}
          >
            <CategoryIcon
              name={category.icon}
              className="w-5 h-5"
              strokeWidth={2.2}
            />
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white truncate">
            {category.name}
          </h2>
          <span className="text-sm font-medium text-neutral-400 dark:text-neutral-500">
            {tasks.filter((t) => t.status !== "done").length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onQuickAddTask(category.id)}
            className="tm-btn-ghost !px-3 !py-2.5"
            title="Add task"
          >
            <Plus className="w-5 h-5" />
          </button>
          {canEditCategory && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="tm-btn-ghost !px-3 !py-2.5"
                title="Category options"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 z-20 tm-card py-1 min-w-[160px] tm-fade">
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onEditCategory(category);
                      }}
                      className="block w-full text-left px-4 py-2.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      Edit category
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tasks */}
      {ordered.length === 0 ? (
        <button
          onClick={() => onQuickAddTask(category.id)}
          className="w-full rounded-2xl border-2 border-dashed border-neutral-200 dark:border-neutral-800 px-5 py-6 text-neutral-400 dark:text-neutral-500 hover:border-neutral-300 dark:hover:border-neutral-700 hover:text-neutral-600 dark:hover:text-neutral-400 text-sm"
        >
          + Add first task
        </button>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={ordered.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {ordered.map((task) => (
                <SortableTaskCard
                  key={task.id}
                  task={task}
                  categoryColor={category.color}
                  onToggleDone={() => toggleTaskDone(task.id)}
                  onOpen={() => onOpenTask(task)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}
