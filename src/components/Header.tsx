import {
  AlertTriangle,
  Bell,
  BellOff,
  CheckCircle2,
  CircleDashed,
  LogOut,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Sun,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useData } from "../context/DataContext";
import { APP_NAME } from "../lib/constants";
import {
  disableOneSignalPush,
  enableOneSignalPushFromUserGesture,
  isBellGreen,
  isOneSignalConfigured,
  readOneSignalBellState,
  watchOneSignalBellState,
  type OneSignalBellState,
} from "../lib/onesignal";
import { requestNotificationPermission } from "../lib/notifications";
import { cx } from "../lib/utils";

interface Props {
  view: "active" | "completed";
  onChangeView: (v: "active" | "completed") => void;
  search: string;
  onChangeSearch: (s: string) => void;
  onAddCategory: () => void;
  onManageUsers?: () => void;
  canManageCategories?: boolean;
}

export function Header({
  view,
  onChangeView,
  search,
  onChangeSearch,
  onAddCategory,
  onManageUsers,
  canManageCategories = true,
}: Props) {
  const { signOut, user, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { syncing, forceSync, lastSyncError, pendingWrites } = useData();
  const [bell, setBell] = useState<OneSignalBellState>(() => ({
    nativePerm:
      typeof Notification !== "undefined" ? Notification.permission : "denied",
    optedIn: null,
  }));

  const refreshBell = useCallback(async () => {
    setBell(await readOneSignalBellState());
  }, []);

  useEffect(() => {
    void refreshBell();
  }, [user?.id, refreshBell]);

  useEffect(() => {
    if (!isOneSignalConfigured()) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    void watchOneSignalBellState(() => {
      if (!cancelled) void refreshBell();
    }).then((unsub) => {
      if (cancelled) unsub();
      else cleanup = unsub;
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [refreshBell]);

  const bellOn = isBellGreen(bell);

  const onBellClick = async () => {
    if (isOneSignalConfigured()) {
      if (typeof Notification !== "undefined" && Notification.permission === "denied") {
        window.alert(
          "Notifications are blocked for this site. Open your browser’s site settings, allow notifications for this page, then try again.",
        );
        return;
      }
      const state = await readOneSignalBellState();
      if (isBellGreen(state)) {
        await disableOneSignalPush();
      } else {
        await enableOneSignalPushFromUserGesture();
      }
      await refreshBell();
      return;
    }

    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      window.alert(
        "To turn off deadline reminders, change notification permission in your browser’s site settings for this page.",
      );
      return;
    }
    await requestNotificationPermission();
    await refreshBell();
  };

  return (
    <header className="sticky top-0 z-30 bg-white/85 dark:bg-neutral-950/85 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto max-w-4xl px-5 py-4">
        {/* Top row: brand + user + theme + logout */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neutral-900 dark:bg-white flex items-center justify-center">
              <CheckCircle2
                className="w-5 h-5 text-green-400 dark:text-green-500"
                strokeWidth={2.5}
              />
            </div>
            <div>
              <div className="text-xs font-semibold tracking-[0.22em] text-neutral-500 dark:text-neutral-400">
                {APP_NAME}
              </div>
              <div className="text-sm font-semibold text-neutral-900 dark:text-white">
                {user?.displayName ?? "—"}
                {isAdmin && (
                  <span className="ml-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    Admin
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isAdmin && onManageUsers && (
              <button
                onClick={onManageUsers}
                title="User access"
                className="tm-btn-ghost !px-3 !py-3"
              >
                <Users className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => void forceSync()}
              title={
                pendingWrites > 0
                  ? `${pendingWrites} change${pendingWrites === 1 ? "" : "s"} waiting to sync`
                  : lastSyncError ?? "Sync with Supabase"
              }
              className={cx(
                "tm-btn-ghost !px-3 !py-3 relative",
                (lastSyncError || pendingWrites > 0) &&
                  "text-amber-500 dark:text-amber-400",
              )}
            >
              <RefreshCw
                className={cx("w-5 h-5", syncing && "animate-spin")}
              />
              {pendingWrites > 0 && (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                  {pendingWrites > 99 ? "99+" : pendingWrites}
                </span>
              )}
            </button>
            <button
              onClick={() => void onBellClick()}
              title={
                isOneSignalConfigured()
                  ? bellOn
                    ? "Push on (tap to turn off team alerts on this device)"
                    : "Push off — tap to allow notifications and register this device"
                  : bellOn
                    ? "Deadline reminders on (change in browser settings to off)"
                    : "Enable deadline reminders"
              }
              className="tm-btn-ghost !px-3 !py-3"
            >
              {bellOn ? (
                <Bell className="w-5 h-5 text-green-500" />
              ) : (
                <BellOff className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to light" : "Switch to dark"}
              className="tm-btn-ghost !px-3 !py-3"
            >
              {theme === "dark" ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={signOut}
              title="Sign out"
              className="tm-btn-ghost !px-3 !py-3"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sync status banner — only visible when something needs attention */}
        {(pendingWrites > 0 || lastSyncError) && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">
                {pendingWrites > 0
                  ? `${pendingWrites} change${pendingWrites === 1 ? "" : "s"} not yet synced to Supabase. Your work is saved locally.`
                  : lastSyncError}
              </span>
            </div>
            <button
              onClick={() => void forceSync()}
              disabled={syncing}
              className="flex-shrink-0 text-xs font-semibold underline underline-offset-2 hover:no-underline disabled:opacity-50"
            >
              {syncing ? "Retrying…" : "Retry now"}
            </button>
          </div>
        )}

        {/* Tabs + search + add */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex rounded-xl bg-neutral-100 dark:bg-neutral-900 p-1">
            <button
              onClick={() => onChangeView("active")}
              className={cx(
                "flex-1 sm:flex-none px-5 py-2.5 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2",
                view === "active"
                  ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white"
                  : "text-neutral-500 dark:text-neutral-400",
              )}
            >
              <CircleDashed className="w-4 h-4" /> Active
            </button>
            <button
              onClick={() => onChangeView("completed")}
              className={cx(
                "flex-1 sm:flex-none px-5 py-2.5 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2",
                view === "completed"
                  ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white"
                  : "text-neutral-500 dark:text-neutral-400",
              )}
            >
              <CheckCircle2 className="w-4 h-4" /> Completed
            </button>
          </div>

          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => onChangeSearch(e.target.value)}
              className="tm-input pl-12"
            />
          </div>

          {canManageCategories && (
            <button
              onClick={onAddCategory}
              className="tm-btn-primary sm:!px-4"
              title="New category"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Category</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
