import { Bold, Italic, Underline } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useRef, type ReactNode } from "react";
import { cx } from "../lib/utils";

export interface MinimalRichEditorHandle {
  getHtml: () => string;
  focusEditor: () => void;
}

interface Props {
  /** Remount editor when switching notes / new draft. */
  editKey: string;
  initialHtml: string;
  className?: string;
}

/** Rich text is stored as HTML (<b>, <i>, <u>). Uses contentEditable + execCommand. */
export const MinimalRichEditor = forwardRef<MinimalRichEditorHandle, Props>(
  function MinimalRichEditor({ editKey, initialHtml, className }, ref) {
    const editorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const el = editorRef.current;
      if (!el) return;
      el.innerHTML = initialHtml?.trim()
        ? initialHtml
        : "<p><br></p>";
    }, [editKey, initialHtml]);

    useImperativeHandle(ref, () => ({
      getHtml: () =>
        normalizeEditorHtml(editorRef.current?.innerHTML ?? ""),
      focusEditor: () => editorRef.current?.focus(),
    }));

    const exec = (cmd: "bold" | "italic" | "underline") => {
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      document.execCommand(cmd, false);
    };

    return (
      <div
        className={cx(
          "rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden bg-white dark:bg-neutral-950",
          className,
        )}
      >
        <div className="flex items-center gap-0.5 px-2 py-2 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/80">
          <ToolbarBtn
            aria-label="Bold"
            icon={<Bold className="w-4 h-4" />}
            onMouseDown={(e) => {
              e.preventDefault();
              exec("bold");
            }}
          />
          <ToolbarBtn
            aria-label="Italic"
            icon={<Italic className="w-4 h-4" />}
            onMouseDown={(e) => {
              e.preventDefault();
              exec("italic");
            }}
          />
          <ToolbarBtn
            aria-label="Underline"
            icon={<Underline className="w-4 h-4" />}
            onMouseDown={(e) => {
              e.preventDefault();
              exec("underline");
            }}
          />
        </div>
        <div
          ref={editorRef}
          role="textbox"
          aria-multiline
          aria-label="Note body"
          contentEditable
          suppressContentEditableWarning
          onPaste={(e) => {
            e.preventDefault();
            const text = e.clipboardData.getData("text/plain");
            document.execCommand("insertText", false, text);
          }}
          className={cx(
            "tm-note-editor px-4 py-3 min-h-[200px] max-h-[50vh] overflow-y-auto text-base",
            "text-neutral-900 dark:text-neutral-100 outline-none leading-relaxed",
          )}
        />
      </div>
    );
  },
);

/** Collapse placeholder-only markup to stored empty string semantics. */
function normalizeEditorHtml(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    const doc = new DOMParser().parseFromString(trimmed, "text/html");
    const plain = (doc.body.textContent ?? "").replace(/\u00a0/g, " ").trim();
    if (!plain) return "";
  } catch {
    /* keep trimmed */
  }
  return trimmed;
}

function ToolbarBtn({
  icon,
  "aria-label": ariaLabel,
  onMouseDown,
}: {
  icon: ReactNode;
  "aria-label": string;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onMouseDown={onMouseDown}
      className="tm-btn-ghost !px-2.5 !py-2 rounded-lg"
    >
      {icon}
    </button>
  );
}
