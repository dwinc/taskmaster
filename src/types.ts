export type TaskStatus = "not_done" | "in_progress" | "blocked" | "done";

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Category {
  id: string;
  name: string;
  color: string; // hex
  icon: string; // lucide icon name
  position: number;
  user_name: string;
  created_at: string;
}

export interface Task {
  id: string;
  category_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  deadline: string | null; // ISO timestamp
  position: number;
  user_name: string;
  /** Set by DB trigger; used for admin push when a member creates a task. */
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  tags: string[];
  subtasks: Subtask[];
}

export interface Note {
  id: string;
  user_id: string;
  title: string;
  body_html: string;
  updated_at: string;
}

export interface AppData {
  categories: Category[];
  tasks: Task[];
}
