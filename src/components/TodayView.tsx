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
import { CalendarCheck2 } from "lucide-react";
import { useMemo } from "react";
import type { Task } from "../types";
import { useData } from "../context/DataContext";
import { SortableTaskCard } from "./SortableTaskCard";

interface Props {
  tasks: Task[];
  onOpenTask: (task: Task) => void;
}

export function TodayView({ tasks, onOpenTask }: Props) {
  const { categories, reorderTodayTasks, toggleTaskDone, setTaskToday } =
    useData();
  const catMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ordered = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.today_position !== b.today_position) {
        return a.today_position - b.today_position;
      }
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
    reorderTodayTasks(next.map((t) => t.id));
  };

  if (ordered.length === 0) {
    return (
      <div className="text-center py-20 text-neutral-400 dark:text-neutral-600 px-4">
        <CalendarCheck2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
        <p className="text-base text-neutral-600 dark:text-neutral-400 font-medium">
          Nothing on your Today list yet
        </p>
        <p className="text-sm mt-2 max-w-sm mx-auto leading-relaxed">
          Open{" "}
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            All tasks
          </span>{" "}
          and tap the calendar icon on a task to plan it for today.
        </p>
      </div>
    );
  }

  return (
    <section className="mb-10">
      <div className="flex items-center gap-3 mb-4 px-1">
        <span className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-green-500/15 text-green-600 dark:text-green-400">
          <CalendarCheck2 className="w-5 h-5" strokeWidth={2.2} />
        </span>
        <h2 className="text-xl md:text-2xl font-bold text-neutral-900 dark:text-white">
          Today
        </h2>
        <span className="text-sm font-medium text-neutral-400 dark:text-neutral-500">
          {ordered.length}
        </span>
      </div>

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
            {ordered.map((task) => {
              const cat = catMap.get(task.category_id);
              const color = cat?.color ?? "#22c55e";
              return (
                <SortableTaskCard
                  key={task.id}
                  task={task}
                  categoryColor={color}
                  onToggleDone={() => toggleTaskDone(task.id)}
                  onOpen={() => onOpenTask(task)}
                  todayToggle={{
                    isOnToday: true,
                    onToggle: () => setTaskToday(task.id, false),
                  }}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
}
