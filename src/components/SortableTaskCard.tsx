import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Task } from "../types";
import { TaskCard } from "./TaskCard";

interface Props {
  task: Task;
  categoryColor: string;
  onToggleDone: () => void;
  onOpen: () => void;
  todayToggle?: { isOnToday: boolean; onToggle: () => void };
}

export function SortableTaskCard(props: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.task.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TaskCard
        {...props}
        dragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}
