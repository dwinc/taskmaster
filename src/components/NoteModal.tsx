import { Loader2, Share2, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Note } from "../types";
import { Modal } from "./Modal";
import {
  MinimalRichEditor,
  type MinimalRichEditorHandle,
} from "./MinimalRichEditor";
import { shareNoteText } from "../lib/share";
import { cx } from "../lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Increment when opening \"new note\" so the editor remounts with empty content. */
  draftKey?: number;
  note: Note | null;
  onSave: (draft: {
    id?: string;
    title: string;
    body_html: string;
  }) => Promise<{ error: string | null }>;
  onDelete?: (id: string) => Promise<{ error: string | null }>;
}

export function NoteModal({
  open,
  onClose,
  draftKey = 0,
  note,
  onSave,
  onDelete,
}: Props) {
  const editorRef = useRef<MinimalRichEditorHandle>(null);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(note?.title ?? "");
  }, [open, note?.id, note?.title]);

  const editKey = note?.id ?? `new-${draftKey}`;

  const handleSave = async () => {
    const body_html = editorRef.current?.getHtml() ?? "";
    setSaving(true);
    const result = await onSave({
      id: note?.id ?? undefined,
      title,
      body_html,
    });
    setSaving(false);
    if (result.error) {
      window.alert(result.error);
      return;
    }
    onClose();
  };

  const handleShare = async () => {
    const body_html = editorRef.current?.getHtml() ?? "";
    const shareTitle = title.trim() || "Note";
    setSharing(true);
    const res = await shareNoteText(shareTitle, body_html);
    setSharing(false);
    if (res.method === "clipboard") {
      window.alert("Copied note to clipboard (share sheet not available).");
    } else if (res.method === "none") {
      window.alert(
        "Could not open share — try saving and sharing from another app.",
      );
    }
  };

  const handleDelete = async () => {
    if (!note?.id || !onDelete) return;
    if (!window.confirm("Delete this note? This cannot be undone.")) return;
    setDeleting(true);
    const result = await onDelete(note.id);
    setDeleting(false);
    if (result.error) {
      window.alert(result.error);
      return;
    }
    onClose();
  };

  const bodyInitial = note?.body_html ?? "";

  return (
    <Modal open={open} onClose={onClose} title={note ? "Edit note" : "New note"} maxWidth="max-w-4xl">
      <div className="px-6 py-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wide">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="tm-input"
            placeholder="Untitled"
            enterKeyHint="done"
          />
        </div>
        <MinimalRichEditor
          ref={editorRef}
          editKey={`${editKey}-${open}`}
          initialHtml={bodyInitial}
        />
        <div className="flex flex-wrap gap-2 items-center pt-1">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="tm-btn-primary !px-5"
          >
            {saving && <Loader2 className="w-5 h-5 animate-spin" />}
            Save
          </button>
          <button
            type="button"
            onClick={() => void handleShare()}
            disabled={sharing}
            className="tm-btn-subtle !px-4"
          >
            {sharing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Share2 className="w-5 h-5" />
            )}
            Share
          </button>
          {note && onDelete && (
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleting}
              title="Delete note"
              aria-label="Delete note"
              className={cx(
                "tm-btn-ghost ml-auto border border-red-200 text-red-600 hover:bg-red-50",
                "dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40",
              )}
            >
              {deleting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Trash2 className="w-5 h-5" />
              )}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
