import { formatDistanceToNow } from "date-fns";
import { FileText } from "lucide-react";
import { useMemo } from "react";
import type { Note } from "../types";
import { stripNoteHtml } from "../lib/noteHtml";
import { cx } from "../lib/utils";

interface Props {
  notes: Note[];
  search: string;
  loading: boolean;
  error?: string | null;
  onOpenNote: (n: Note) => void;
}

export function NotesView({
  notes,
  search,
  loading,
  error,
  onOpenNote,
}: Props) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) => {
      const plain = `${n.title}\n${stripNoteHtml(n.body_html)}`.toLowerCase();
      return plain.includes(q);
    });
  }, [notes, search]);

  if (loading) {
    return (
      <div className="text-center py-20 text-neutral-400 dark:text-neutral-600">
        Loading notes…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 px-5 py-4 text-sm text-amber-800 dark:text-amber-200">
        {error}
        {" "}
        <span className="opacity-80">
          Run the SQL in <code className="text-xs px-1">supabase/notes-schema.sql</code> in your
          project.
        </span>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-24 px-4">
        <FileText className="w-12 h-12 mx-auto mb-4 text-neutral-300 dark:text-neutral-600" />
        <div className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
          {notes.length === 0 ? "No notes yet" : "No matches"}
        </div>
        <p className="text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto text-base">
          {notes.length === 0
            ? "Tap the + button to add your first note."
            : "Try a different search."}
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3 list-none">
      {filtered.map((n) => {
        const preview = stripNoteHtml(n.body_html);
        const truncated =
          preview.length > 140 ? `${preview.slice(0, 140)}…` : preview || "—";

        let rel: string;
        try {
          rel = formatDistanceToNow(new Date(n.updated_at), {
            addSuffix: true,
          });
        } catch {
          rel = n.updated_at;
        }

        return (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => onOpenNote(n)}
              className={cx(
                "tm-card w-full text-left p-5 transition-colors",
                "hover:border-neutral-300 dark:hover:border-neutral-700",
              )}
            >
              <div className="flex items-start gap-4">
                <div className="mt-1 flex-shrink-0 w-11 h-11 rounded-xl bg-neutral-900 dark:bg-white flex items-center justify-center">
                  <FileText className="w-[18px] h-[18px] text-neutral-400 dark:text-neutral-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-neutral-900 dark:text-white text-base truncate pr-2">
                      {n.title.trim() || "Untitled"}
                    </h3>
                  </div>
                  <time
                    dateTime={n.updated_at}
                    className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 block"
                  >
                    {rel}
                  </time>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-2 line-clamp-3">
                    {truncated}
                  </p>
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
