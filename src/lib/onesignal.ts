import OneSignal from "react-onesignal";

const APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID?.trim();

let initPromise: Promise<void> | null = null;

export function isOneSignalConfigured(): boolean {
  return Boolean(APP_ID);
}

/**
 * Load OneSignal once. Safe under React StrictMode (second render reuses the same promise).
 */
export async function initOneSignal(): Promise<void> {
  if (!APP_ID) return;
  if (!initPromise) {
    const base = import.meta.env.BASE_URL;
    const swPath = `${base}OneSignalSDKWorker.js`;
    initPromise = OneSignal.init({
      appId: APP_ID,
      allowLocalhostAsSecureOrigin: import.meta.env.DEV,
      serviceWorkerPath: swPath,
      serviceWorkerUpdaterPath: swPath,
    });
  }
  await initPromise;
}

export async function setOneSignalExternalUser(
  externalId: string | null,
): Promise<void> {
  if (!APP_ID) return;
  await initOneSignal();
  if (externalId) {
    await OneSignal.login(externalId);
  } else {
    await OneSignal.logout();
  }
}

/** Web push opt-in (OneSignal). Returns false if not configured or denied. */
export async function requestOneSignalPushPermission(): Promise<boolean> {
  if (!APP_ID) return false;
  await initOneSignal();
  return OneSignal.Notifications.requestPermission();
}

export type OneSignalBellState = {
  nativePerm: NotificationPermission;
  /** null = OneSignal not configured; otherwise whether this device is opted into push. */
  optedIn: boolean | null;
};

export async function readOneSignalBellState(): Promise<OneSignalBellState> {
  const nativePerm =
    typeof Notification !== "undefined" ? Notification.permission : "denied";
  if (!APP_ID) return { nativePerm, optedIn: null };
  await initOneSignal();
  try {
    return { nativePerm, optedIn: OneSignal.User.PushSubscription.optedIn === true };
  } catch {
    return { nativePerm, optedIn: false };
  }
}

/**
 * Register for OneSignal dashboard + API targeting: browser permission + push subscription.
 * Call after OneSignal.login (AuthContext) so External user id is set.
 */
export async function enableOneSignalPushFromUserGesture(): Promise<void> {
  if (!APP_ID) return;
  await initOneSignal();
  const granted = await OneSignal.Notifications.requestPermission();
  if (!granted) return;
  await OneSignal.User.PushSubscription.optIn();
}

export async function disableOneSignalPush(): Promise<void> {
  if (!APP_ID) return;
  await initOneSignal();
  await OneSignal.User.PushSubscription.optOut();
}

/** Bell is “on” only when the browser allows notifications and (if OneSignal) subscription is opted in. */
export function isBellGreen(state: OneSignalBellState): boolean {
  if (state.nativePerm !== "granted") return false;
  if (!APP_ID) return true;
  return state.optedIn === true;
}

/**
 * Subscribe to permission / subscription changes so the bell UI can update.
 */
export async function watchOneSignalBellState(
  onChange: () => void,
): Promise<() => void> {
  if (!APP_ID) return () => {};
  await initOneSignal();
  const fn = () => onChange();
  OneSignal.Notifications.addEventListener("permissionChange", fn);
  OneSignal.User.PushSubscription.addEventListener("change", fn);
  return () => {
    OneSignal.Notifications.removeEventListener("permissionChange", fn);
    OneSignal.User.PushSubscription.removeEventListener("change", fn);
  };
}
