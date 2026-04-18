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
