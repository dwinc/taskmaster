import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Note } from "../types";
import { supabase } from "../lib/supabase";
import { uuid } from "../lib/utils";
import { useAuth } from "./AuthContext";

interface NotesValue {
  notes: Note[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  upsertNote: (input: {
    id?: string;
    title: string;
    body_html: string;
  }) => Promise<{ error: string | null }>;
  deleteNote: (id: string) => Promise<{ error: string | null }>;
}

const NotesContext = createContext<NotesValue | null>(null);

const now = () => new Date().toISOString();

export function NotesProvider({ children }: { children: ReactNode }) {
  const { authed, user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!authed || !user) {
      setNotes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: qErr } = await supabase
      .from("notes")
      .select("id,user_id,title,body_html,updated_at")
      .order("updated_at", { ascending: false });

    if (qErr) {
      console.warn("[taskmaster] notes fetch failed:", qErr);
      setError(qErr.message);
      setNotes([]);
    } else {
      setError(null);
      setNotes((data ?? []) as Note[]);
    }
    setLoading(false);
  }, [authed, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!authed) return;
    const onVis = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [authed, refresh]);

  const upsertNote: NotesValue["upsertNote"] = useCallback(
    async ({ id: existingId, title, body_html }) => {
      if (!user) return { error: "Not signed in" };
      const id = existingId ?? uuid();
      const row = {
        id,
        user_id: user.id,
        title: title.trim(),
        body_html,
        updated_at: now(),
      };

      const { error: writeErr } = await supabase.from("notes").upsert(row);

      if (writeErr) {
        console.warn("[taskmaster] notes upsert failed:", writeErr);
        return { error: writeErr.message };
      }
      setError(null);
      await refresh();
      return { error: null };
    },
    [user, refresh],
  );

  const deleteNote: NotesValue["deleteNote"] = useCallback(
    async (id) => {
      const { error: delErr } = await supabase.from("notes").delete().eq("id", id);
      if (delErr) {
        return { error: delErr.message };
      }
      setError(null);
      await refresh();
      return { error: null };
    },
    [refresh],
  );

  const value = useMemo(
    (): NotesValue => ({
      notes,
      loading,
      error,
      refresh,
      upsertNote,
      deleteNote,
    }),
    [notes, loading, error, refresh, upsertNote, deleteNote],
  );

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}

export function useNotes() {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error("useNotes must be used within NotesProvider");
  return ctx;
}
