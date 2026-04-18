import { format } from "date-fns";
import { CheckCircle2 } from "lucide-react";
import type { Task } from "../types";
import { useData } from "../context/DataContext";
import { CategoryIcon } from "./CategoryIcon";
import { hexAlpha } from "../lib/utils";

interface Props {
  tasks: Task[];
  onOpenTask: (task: Task) => void;
}

export function CompletedView({ tasks, onOpenTask }: Props) {
  const { categories } = useData();
  const catMap = new Map(categories.map((c) => [c.id, c]));

  // Group by date completed (yyyy-mm-dd)
  const groups = new Map<string, Task[]>();
  for (const t of tasks) {
    const key = t.completed_at
      ? format(new Date(t.completed_at), "yyyy-MM-dd")
      : "unknown";
    const arr = groups.get(key) ?? [];
    arr.push(t);
    groups.set(key, arr);
  }
  const sortedKeys = Array.from(groups.keys()).sort((a, b) =>
    b.localeCompare(a),
  );

  if (tasks.length === 0) {
    return (
      <div className="text-center py-20 text-neutral-400 dark:text-neutral-600">
        <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
        <p className="text-base">No completed tasks yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {sortedKeys.map((key) => {
        const list = groups.get(key)!.sort((a, b) =>
          (b.completed_at ?? "").localeCompare(a.completed_at ?? ""),
        );
        const label =
          key === "unknown"
            ? "Earlier"
            : format(new Date(key), "EEEE, MMMM d, yyyy");
        return (
          <section key={key}>
            <h3 className="text-sm font-semibold tracking-wide uppercase text-neutral-500 dark:text-neutral-400 mb-3 px-1">
              {label}
            </h3>
            <div className="space-y-2">
              {list.map((t) => {
                const cat = catMap.get(t.category_id);
                return (
                  <button
                    key={t.id}
                    onClick={() => onOpenTask(t)}
                    className="tm-card w-full text-left flex items-center gap-4 px-5 py-4 hover:border-neutral-300 dark:hover:border-neutral-700"
                  >
                    <span
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: cat
                          ? hexAlpha(cat.color, 0.15)
                          : undefined,
                        color: cat?.color,
                      }}
                    >
                      {cat && (
                        <CategoryIcon
                          name={cat.icon}
                          className="w-4 h-4"
                          strokeWidth={2.2}
                        />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-neutral-900 dark:text-neutral-100 truncate line-through opacity-70">
                        {t.title}
                      </div>
                      {cat && (
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">
                          {cat.name}
                          {t.completed_at &&
                            ` · ${format(new Date(t.completed_at), "HH:mm")}`}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
