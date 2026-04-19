import {
  AlertTriangle,
  Bell,
  BellOff,
  CheckCircle2,
  LogOut,
  Menu,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Sun,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuTitleId = useId();

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => setMobileMenuOpen(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

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
        await enableOneSignalPushFromUserGesture(user?.id ?? null);
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

  const toolbarIconBtn =
    "tm-btn-ghost !px-3 !py-2.5 md:!py-3";

  const renderViewToggle = () => (
    <button
      type="button"
      onClick={() => onChangeView(view === "active" ? "completed" : "active")}
      className={cx(
        toolbarIconBtn,
        view === "completed" &&
          "!bg-neutral-200/90 dark:!bg-neutral-800 text-green-600 dark:text-green-400",
      )}
      title={view === "active" ? "Show completed tasks" : "Show active tasks"}
      aria-pressed={view === "completed"}
      aria-label={
        view === "active" ? "Show completed tasks" : "Show active tasks"
      }
    >
      <CheckCircle2
        className="w-5 h-5"
        strokeWidth={view === "completed" ? 2.75 : 2}
      />
    </button>
  );

  return (
    <header className="sticky top-0 z-30 bg-white/85 dark:bg-neutral-950/85 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto max-w-4xl px-4 py-3 md:px-5 md:py-4">
        {/* Top row: brand + desktop actions or mobile menu */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 md:gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-neutral-900 dark:bg-white flex items-center justify-center flex-shrink-0">
              <CheckCircle2
                className="w-[18px] h-[18px] md:w-5 md:h-5 text-green-400 dark:text-green-500"
                strokeWidth={2.5}
              />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] md:text-xs font-semibold tracking-[0.18em] md:tracking-[0.22em] text-neutral-500 dark:text-neutral-400 truncate">
                {APP_NAME}
              </div>
              <div className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
                {user?.displayName ?? "—"}
                {isAdmin && (
                  <span className="ml-1.5 md:ml-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    Admin
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-1 flex-shrink-0">
            {renderViewToggle()}
            {isAdmin && onManageUsers && (
              <button
                onClick={onManageUsers}
                title="User access"
                className={toolbarIconBtn}
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
                toolbarIconBtn,
                "relative",
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
              className={toolbarIconBtn}
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
              className={toolbarIconBtn}
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
              className={toolbarIconBtn}
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          <div className="flex md:hidden items-center gap-0.5 flex-shrink-0">
            {renderViewToggle()}
            <button
              type="button"
              className={cx(
                "tm-btn-ghost !px-3 !py-2.5 flex-shrink-0",
                mobileMenuOpen && "bg-neutral-100 dark:bg-neutral-800",
              )}
              aria-expanded={mobileMenuOpen}
              aria-controls={mobileMenuTitleId}
              onClick={() => setMobileMenuOpen((v) => !v)}
              title="Menu"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" aria-hidden />
              ) : (
                <Menu className="w-6 h-6" aria-hidden />
              )}
              <span className="sr-only">{mobileMenuOpen ? "Close menu" : "Open menu"}</span>
            </button>
          </div>
        </div>

        {isAdmin && !isOneSignalConfigured() && (
          <p className="mt-2 text-[11px] md:text-xs leading-snug text-amber-700 dark:text-amber-300/90">
            Team push is not in this build: set{" "}
            <code className="rounded bg-neutral-200/80 px-1 py-0.5 text-[10px] md:text-[11px] dark:bg-neutral-800">
              VITE_ONESIGNAL_APP_ID
            </code>{" "}
            in your host&apos;s build environment and redeploy (Vite bakes it in at{" "}
            <code className="rounded bg-neutral-200/80 px-1 py-0.5 text-[10px] md:text-[11px] dark:bg-neutral-800">
              npm run build
            </code>
            ).
          </p>
        )}

        {(pendingWrites > 0 || lastSyncError) && (
          <div className="mt-2 md:mt-3 flex items-center justify-between gap-2 md:gap-3 rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 md:px-4 md:py-2.5 text-xs md:text-sm text-amber-700 dark:text-amber-300">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span className="line-clamp-2 md:line-clamp-none md:truncate">
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

        <div className="mt-2 md:mt-3">
          <div className="hidden md:flex gap-2 items-center">
            <div className="flex-1 min-w-0 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 pointer-events-none" />
              <input
                type="search"
                enterKeyHint="search"
                placeholder="Search tasks..."
                value={search}
                onChange={(e) => onChangeSearch(e.target.value)}
                className="tm-input pl-12 !py-3 text-base"
              />
            </div>
            {canManageCategories && (
              <button
                onClick={onAddCategory}
                className="tm-btn-primary !px-5 !py-3 flex-shrink-0"
                title="New category"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden md:inline">Category</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile slide-over — portaled to body so backdrop-blur on <header> does not trap position:fixed */}
      {mobileMenuOpen &&
        createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              aria-label="Close menu"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div
              id={mobileMenuTitleId}
              className="fixed top-0 right-0 bottom-0 z-50 w-[min(100%,20rem)] md:hidden flex flex-col bg-white dark:bg-neutral-950 border-l border-neutral-200 dark:border-neutral-800 shadow-xl tm-fade"
              role="dialog"
              aria-modal="true"
              aria-labelledby="tm-mobile-menu-heading"
            >
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
              <h2 id="tm-mobile-menu-heading" className="text-sm font-semibold text-neutral-900 dark:text-white">
                Menu
              </h2>
              <button
                type="button"
                className="tm-btn-ghost !px-2.5 !py-2"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-3 pt-2 pb-3 border-b border-neutral-200 dark:border-neutral-800 space-y-2 shrink-0">
              <label htmlFor="tm-mobile-search" className="sr-only">
                Search tasks
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-neutral-400 pointer-events-none" />
                <input
                  id="tm-mobile-search"
                  type="search"
                  enterKeyHint="search"
                  placeholder="Search tasks..."
                  value={search}
                  onChange={(e) => onChangeSearch(e.target.value)}
                  className="tm-input pl-10 !py-2.5 text-[15px]"
                />
              </div>
              {canManageCategories && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onAddCategory();
                  }}
                  className="tm-btn-primary w-full !py-2.5"
                >
                  <Plus className="w-5 h-5" />
                  New category
                </button>
              )}
            </div>
            <nav className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 min-h-0">
              {isAdmin && onManageUsers && (
                <button
                  type="button"
                  className="flex items-center gap-3 w-full rounded-xl px-3 py-3 text-left text-sm font-medium text-neutral-800 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onManageUsers();
                  }}
                >
                  <Users className="w-5 h-5 flex-shrink-0 opacity-70" />
                  User access
                </button>
              )}
              <button
                type="button"
                className="flex items-center gap-3 w-full rounded-xl px-3 py-3 text-left text-sm font-medium text-neutral-800 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                onClick={() => {
                  void forceSync();
                }}
              >
                <span className="relative inline-flex">
                  <RefreshCw
                    className={cx("w-5 h-5 flex-shrink-0 opacity-70", syncing && "animate-spin")}
                  />
                  {pendingWrites > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5">
                      {pendingWrites > 99 ? "99+" : pendingWrites}
                    </span>
                  )}
                </span>
                Sync with Supabase
              </button>
              <button
                type="button"
                className="flex items-center gap-3 w-full rounded-xl px-3 py-3 text-left text-sm font-medium text-neutral-800 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                onClick={() => {
                  void onBellClick();
                }}
              >
                {bellOn ? (
                  <Bell className="w-5 h-5 flex-shrink-0 text-green-500" />
                ) : (
                  <BellOff className="w-5 h-5 flex-shrink-0 opacity-70" />
                )}
                {isOneSignalConfigured() ? "Team notifications" : "Deadline reminders"}
              </button>
              <button
                type="button"
                className="flex items-center gap-3 w-full rounded-xl px-3 py-3 text-left text-sm font-medium text-neutral-800 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                onClick={() => {
                  toggleTheme();
                }}
              >
                {theme === "dark" ? (
                  <Sun className="w-5 h-5 flex-shrink-0 opacity-70" />
                ) : (
                  <Moon className="w-5 h-5 flex-shrink-0 opacity-70" />
                )}
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </button>
              <button
                type="button"
                className="flex items-center gap-3 w-full rounded-xl px-3 py-3 text-left text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10"
                onClick={() => {
                  setMobileMenuOpen(false);
                  void signOut();
                }}
              >
                <LogOut className="w-5 h-5 flex-shrink-0" />
                Sign out
              </button>
            </nav>
            </div>
          </>,
          document.body,
        )}
    </header>
  );
}
