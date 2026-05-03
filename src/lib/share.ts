import { stripNoteHtml } from "./noteHtml";

/**
 * Shares via the OS / browser share sheet when available (common on phones).
 * Falls back to mailto, then clipboard.
 */
export async function shareNoteText(
  title: string,
  bodyHtml: string,
): Promise<{ method: "share" | "mailto" | "clipboard" | "none" }> {
  const textBody = stripNoteHtml(bodyHtml);
  const combined = `${title.trim() || "Note"}\n\n${textBody}`.trim();

  const payload: ShareData = {
    title: title.trim() || "Note",
    text: combined,
  };

  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      const can =
        typeof navigator.canShare !== "function" || navigator.canShare(payload);
      if (can) {
        await navigator.share(payload);
        return { method: "share" };
      }
    }
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      return { method: "none" };
    }
    console.warn("[taskmaster] share failed:", err);
  }

  const subject = encodeURIComponent(title.trim() || "Note");
  const body = encodeURIComponent(combined);
  const mailto = `mailto:?subject=${subject}&body=${body}`;

  try {
    window.location.href = mailto;
    return { method: "mailto" };
  } catch {
    // ignore
  }

  try {
    await navigator.clipboard.writeText(combined);
    return { method: "clipboard" };
  } catch {
    return { method: "none" };
  }
}
