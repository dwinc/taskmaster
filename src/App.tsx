import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
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
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { DataProvider, useData } from "./context/DataContext";
import { Login } from "./components/Login";
import { Header } from "./components/Header";
import { CategorySection } from "./components/CategorySection";
import { SortableCategorySection } from "./components/SortableCategorySection";
import { CompletedView } from "./components/CompletedView";
import { TaskModal } from "./components/TaskModal";
import { CategoryModal } from "./components/CategoryModal";
import { UserManagementModal } from "./components/UserManagementModal";
import type { Category, Task } from "./types";

function AppShell() {
  const { authReady, session, user } = useAuth();
  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 text-neutral-500 dark:text-neutral-500">
        Loading…
      </div>
    );
  }
  if (!session?.user || !user) {
    return <Login />;
  }
  return (
    <DataProvider>
      <MainView />
    </DataProvider>
  );
}

function MainView() {
  const { isAdmin, allowedCategoryIds } = useAuth();
  const { categories, tasks, loading, reorderCategories } = useData();
  const [view, setView] = useState<"active" | "completed">("active");
  const [search, setSearch] = useState("");
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTaskCategoryId, setNewTaskCategoryId] = useState<string | undefined>();
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [userMgmtOpen, setUserMgmtOpen] = useState(false);

  const openNewTask = (categoryId?: string) => {
    setEditingTask(null);
    setNewTaskCategoryId(categoryId);
    setTaskModalOpen(true);
  };

  const openEditTask = (task: Task) => {
    setEditingTask(task);
    setNewTaskCategoryId(undefined);
    setTaskModalOpen(true);
  };

  const openNewCategory = () => {
    setEditingCategory(null);
    setCategoryModalOpen(true);
  };

  const openEditCategory = (c: Category) => {
    setEditingCategory(c);
    setCategoryModalOpen(true);
  };

  const filterTasks = (list: Task[]): Task[] => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q),
    );
  };

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.position - b.position),
    [categories],
  );

  const visibleCategories = useMemo(() => {
    if (isAdmin || !allowedCategoryIds) return sortedCategories;
    return sortedCategories.filter((c) => allowedCategoryIds.has(c.id));
  }, [sortedCategories, isAdmin, allowedCategoryIds]);

  const visibleCategoryIdSet = useMemo(
    () => new Set(visibleCategories.map((c) => c.id)),
    [visibleCategories],
  );

  const tasksVisible = useMemo(
    () => tasks.filter((t) => visibleCategoryIdSet.has(t.category_id)),
    [tasks, visibleCategoryIdSet],
  );

  const categorySensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleCategoryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = visibleCategories.findIndex((c) => c.id === active.id);
    const newIndex = visibleCategories.findIndex((c) => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(visibleCategories, oldIndex, newIndex);
    reorderCategories(next.map((c) => c.id));
  };

  const activeTasksByCat = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const c of visibleCategories) map.set(c.id, []);
    for (const t of tasksVisible) {
      if (t.status === "done") continue;
      const arr = map.get(t.category_id);
      if (arr) arr.push(t);
    }
    return map;
  }, [tasksVisible, visibleCategories]);

  const completedTasks = useMemo(
    () => filterTasks(tasksVisible.filter((t) => t.status === "done")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasksVisible, search],
  );

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <Header
        view={view}
        onChangeView={setView}
        search={search}
        onChangeSearch={setSearch}
        onAddCategory={openNewCategory}
        onManageUsers={() => setUserMgmtOpen(true)}
        canManageCategories={isAdmin}
      />

      <main className="mx-auto max-w-4xl px-5 py-6 pb-32">
        {loading ? (
          <div className="text-center py-20 text-neutral-400 dark:text-neutral-600">
            Loading…
          </div>
        ) : view === "completed" ? (
          <CompletedView tasks={completedTasks} onOpenTask={openEditTask} />
        ) : visibleCategories.length === 0 ? (
          categories.length === 0 ? (
            <EmptyState onCreate={openNewCategory} isAdmin={isAdmin} />
          ) : (
            <NoAccessEmptyState />
          )
        ) : search.trim() ? (
          // Searching: hide empty categories, no drag reordering (filtered view).
          visibleCategories.map((c) => {
            const taskList = filterTasks(activeTasksByCat.get(c.id) ?? []);
            if (taskList.length === 0) return null;
            return (
              <CategorySection
                key={c.id}
                category={c}
                tasks={taskList}
                onOpenTask={openEditTask}
                onEditCategory={openEditCategory}
                onQuickAddTask={openNewTask}
                canEditCategory={isAdmin}
              />
            );
          })
        ) : isAdmin ? (
          <DndContext
            sensors={categorySensors}
            collisionDetection={closestCenter}
            onDragEnd={handleCategoryDragEnd}
          >
            <SortableContext
              items={visibleCategories.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {visibleCategories.map((c) => (
                <SortableCategorySection
                  key={c.id}
                  category={c}
                  tasks={activeTasksByCat.get(c.id) ?? []}
                  onOpenTask={openEditTask}
                  onEditCategory={openEditCategory}
                  onQuickAddTask={openNewTask}
                  canEditCategory
                />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          visibleCategories.map((c) => (
            <CategorySection
              key={c.id}
              category={c}
              tasks={activeTasksByCat.get(c.id) ?? []}
              onOpenTask={openEditTask}
              onEditCategory={openEditCategory}
              onQuickAddTask={openNewTask}
              canEditCategory={false}
            />
          ))
        )}
      </main>

      {/* Floating add button for tasks */}
      {view === "active" && visibleCategories.length > 0 && (
        <button
          onClick={() => openNewTask()}
          className="fixed bottom-6 right-6 z-20 tm-btn-primary !rounded-full !w-16 !h-16 !p-0 shadow-lg"
          title="New task"
          aria-label="New task"
        >
          <Plus className="w-7 h-7" strokeWidth={2.5} />
        </button>
      )}

      <TaskModal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        task={editingTask}
        defaultCategoryId={newTaskCategoryId}
      />
      <CategoryModal
        open={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        category={editingCategory}
      />
      <UserManagementModal
        open={userMgmtOpen}
        onClose={() => setUserMgmtOpen(false)}
      />
    </div>
  );
}

function EmptyState({
  onCreate,
  isAdmin,
}: {
  onCreate: () => void;
  isAdmin: boolean;
}) {
  return (
    <div className="text-center py-24">
      <div className="text-2xl font-semibold text-neutral-900 dark:text-white mb-2">
        Welcome to TASKMASTER
      </div>
      <p className="text-neutral-500 dark:text-neutral-400 mb-8 text-base">
        Create a category to start organising your tasks.
      </p>
      {isAdmin && (
        <button onClick={onCreate} className="tm-btn-primary">
          <Plus className="w-5 h-5" /> Create your first category
        </button>
      )}
    </div>
  );
}

function NoAccessEmptyState() {
  return (
    <div className="text-center py-24 px-4">
      <div className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">
        No categories assigned
      </div>
      <p className="text-neutral-500 dark:text-neutral-400 text-base max-w-md mx-auto">
        An admin can grant you access to specific categories from{" "}
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          User access
        </span>{" "}
        in the header.
      </p>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </ThemeProvider>
  );
}
