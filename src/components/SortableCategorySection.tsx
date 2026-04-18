import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Category, Task } from "../types";
import { CategorySection } from "./CategorySection";

interface Props {
  category: Category;
  tasks: Task[];
  onOpenTask: (task: Task) => void;
  onEditCategory: (category: Category) => void;
  onQuickAddTask: (categoryId: string) => void;
  canEditCategory?: boolean;
}

export function SortableCategorySection(props: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.category.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <CategorySection
      {...props}
      sortableRef={setNodeRef}
      sortableStyle={style}
      dragHandleProps={{ ...attributes, ...listeners }}
      dragging={isDragging}
    />
  );
}
