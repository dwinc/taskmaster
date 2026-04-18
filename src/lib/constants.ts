export const APP_NAME = "TASKMASTER";

export const SUPABASE_URL = "https://adtwkannmtjfllfdutwz.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_IqHjPokb3SaKilBf-yK2gw_6v6at52k";

export const STORAGE_KEYS = {
  theme: "tm_theme",
  data: "tm_data",
  notified: "tm_notified", // tracks task IDs already notified for a given event
} as const;

// Curated palette — chosen to look good together on both light and dark.
export const CATEGORY_COLORS: { name: string; value: string }[] = [
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Green", value: "#22c55e" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Purple", value: "#a855f7" },
  { name: "Pink", value: "#ec4899" },
  { name: "Slate", value: "#64748b" },
  { name: "Stone", value: "#78716c" },
];

// Curated list of lucide icons that work well as category icons.
// Names must match lucide-react export names (PascalCase).
export const CATEGORY_ICONS: string[] = [
  "Briefcase",
  "Home",
  "Heart",
  "BookOpen",
  "ShoppingCart",
  "Dumbbell",
  "Code",
  "Music",
  "Plane",
  "Coffee",
  "Car",
  "Camera",
  "PenTool",
  "Zap",
  "Star",
  "Target",
  "Flag",
  "Gift",
  "Leaf",
  "Flame",
  "Rocket",
  "Wallet",
  "Palette",
  "Utensils",
  "Hammer",
  "Brain",
  "Folder",
  "Calendar",
];

export const STATUS_META: Record<
  import("../types").TaskStatus,
  { label: string; color: string }
> = {
  not_done: { label: "Not done", color: "#94a3b8" },
  in_progress: { label: "In progress", color: "#3b82f6" },
  blocked: { label: "Blocked", color: "#ef4444" },
  done: { label: "Done", color: "#22c55e" },
};
