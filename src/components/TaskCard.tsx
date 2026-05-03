import { format, formatDistanceToNowStrict, isPast, isToday, isTomorrow } from "date-fns";
import {
  AlertCircle,
  CalendarCheck2,
  CalendarClock,
  GripVertical,
  ListChecks,
} from "lucide-react";
import type { Task } from "../types";
import { cx, hexAlpha, tagColor } from "../lib/utils";
import { STATUS_META } from "../lib/constants";

interface Props {
  task: Task;
  categoryColor: string;
  onToggleDone: () => void;
  onOpen: () => void;
  /** When set, shows add/remove Today control (hidden for completed tasks). */
  todayToggle?: { isOnToday: boolean; onToggle: () => void };
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  dragging?: boolean;
}

function deadlineLabel(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return `Today · ${format(d, "HH:mm")}`;
  if (isTomorrow(d)) return `Tomorrow · ${format(d, "HH:mm")}`;
  return format(d, "EEE d MMM · HH:mm");
}

export function TaskCard({
  task,
  categoryColor,
  onToggleDone,
  onOpen,
  todayToggle,
  dragHandleProps,
  dragging,
}: Props) {
  const isDone = task.status === "done";
  const isBlocked = task.status === "blocked";
  const isInProgress = task.status === "in_progress";
  const statusMeta = STATUS_META[task.status];
  const overdue =
    !isDone && task.deadline ? isPast(new Date(task.deadline)) : false;

  return (
    <div
      className={cx(
        "tm-card tm-fade flex items-center gap-1 md:gap-1.5 pl-[18px] md:pl-2.5 pr-[15px] py-3 transition-transform",
        dragging && "opacity-60 scale-[1.01] shadow-lg",
        isDone && "opacity-60",
      )}
    >
      {dragHandleProps && (
        <button
          {...dragHandleProps}
          type="button"
          className="hidden md:inline-flex flex-shrink-0 items-center justify-center p-0.5 -ml-0.5 text-neutral-300 dark:text-neutral-700 hover:text-neutral-500 dark:hover:text-neutral-400 touch-none leading-none"
          aria-label="Drag"
        >
          <GripVertical className="w-4 h-4" strokeWidth={2} />
        </button>
      )}

      {/* Body */}
      <div
        className="min-w-0 flex-1 cursor-pointer"
        onClick={onOpen}
      >
        <div className="flex items-start gap-3 justify-between">
          <h3
            className={cx(
              "text-base font-semibold leading-snug md:text-lg text-neutral-900 dark:text-neutral-100 min-w-0",
              isDone && "line-through text-neutral-500",
            )}
          >
            {task.title}
          </h3>
          {task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 justify-end flex-shrink-0 max-w-[55%]">
              {task.tags.map((tag) => {
                const color = tagColor(tag);
                return (
                  <span
                    key={tag}
                    className={cx(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase md:text-[11px]",
                      isDone && "opacity-60",
                    )}
                    style={{
                      backgroundColor: hexAlpha(color, 0.15),
                      color,
                    }}
                  >
                    {tag}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {task.description && (
          <p
            className={cx(
              "mt-1.5 text-xs leading-relaxed md:text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2",
              isDone && "line-through",
            )}
          >
            {task.description}
          </p>
        )}

        {/* Meta row */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {/* Status pill (hidden for not_done — visual noise) */}
          {(isInProgress || isBlocked) && !isDone && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium md:text-xs"
              style={{
                backgroundColor: hexAlpha(statusMeta.color, 0.12),
                color: statusMeta.color,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: statusMeta.color }}
              />
              {statusMeta.label}
            </span>
          )}

          {task.subtasks.length > 0 && (
            <span
              className={cx(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium md:text-xs bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
                task.subtasks.every((s) => s.done) &&
                  "!text-green-600 dark:!text-green-400",
              )}
              title="Subtasks"
            >
              <ListChecks className="w-3.5 h-3.5" />
              {task.subtasks.filter((s) => s.done).length}/
              {task.subtasks.length}
            </span>
          )}

          {task.deadline && (
            <span
              className={cx(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium md:text-xs",
                overdue
                  ? "bg-red-500/10 text-red-600 dark:text-red-400"
                  : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
              )}
              title={format(new Date(task.deadline), "PPpp")}
            >
              {overdue ? (
                <AlertCircle className="w-3.5 h-3.5" />
              ) : (
                <CalendarClock className="w-3.5 h-3.5" />
              )}
              {overdue
                ? `Overdue · ${formatDistanceToNowStrict(new Date(task.deadline))} ago`
                : deadlineLabel(task.deadline)}
            </span>
          )}
        </div>
      </div>

      {todayToggle && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            todayToggle.onToggle();
          }}
          className={cx(
            "tm-btn-ghost flex-shrink-0 !p-2 rounded-xl touch-manipulation",
            todayToggle.isOnToday &&
              "text-green-600 dark:text-green-400 bg-green-500/10",
          )}
          title={
            todayToggle.isOnToday ? "Remove from Today" : "Add to Today"
          }
          aria-pressed={todayToggle.isOnToday}
          aria-label={
            todayToggle.isOnToday ? "Remove from Today" : "Add to Today"
          }
        >
          <CalendarCheck2 className="w-5 h-5" strokeWidth={2} />
        </button>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleDone();
        }}
        className="tm-check flex-shrink-0"
        data-checked={isDone}
        style={isDone ? { background: categoryColor, borderColor: categoryColor } : undefined}
        aria-label="Toggle done"
      >
        {isDone && (
          <svg
            viewBox="0 0 20 20"
            className="w-4 h-4 text-white"
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
    </div>
  );
}
