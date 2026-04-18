import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import {
  isOneSignalConfigured,
  setOneSignalExternalUser,
} from "../lib/onesignal";
import { supabase } from "../lib/supabase";
import type { AppUser } from "../lib/users";

interface ProfileRow {
  id: string;
  email: string | null;
  display_name: string | null;
  role: "admin" | "member";
}

interface AuthValue {
  authReady: boolean;
  session: Session | null;
  authed: boolean;
  user: AppUser | null;
  isAdmin: boolean;
  /** null = unrestricted (admin); members get category ids from Supabase. */
  allowedCategoryIds: Set<string> | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  inviteMember: (
    email: string,
    displayName: string,
  ) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthValue | null>(null);

function toAppUser(session: Session, row: ProfileRow): AppUser {
  const email = row.email ?? session.user.email ?? "";
  return {
    id: row.id,
    email,
    displayName:
      row.display_name?.trim() ||
      (email.includes("@") ? email.split("@")[0] : email) ||
      "User",
    role: row.role,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profileRow, setProfileRow] = useState<ProfileRow | null>(null);
  const [allowedCategoryIds, setAllowedCategoryIds] = useState<
    Set<string> | null
  >(null);

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, display_name, role")
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) {
      await supabase.auth.signOut();
      setProfileRow(null);
      setAllowedCategoryIds(null);
      return null;
    }
    setProfileRow(data as ProfileRow);
    return data as ProfileRow;
  }, []);

  const loadMemberGrants = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("user_category_access")
      .select("category_id")
      .eq("user_id", userId);

    if (error) {
      setAllowedCategoryIds(new Set());
      return;
    }
    setAllowedCategoryIds(
      new Set((data ?? []).map((r) => r.category_id as string)),
    );
  }, []);

  useEffect(() => {
    try {
      localStorage.removeItem("tm_auth");
      localStorage.removeItem("tm_member_category_access");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) {
      setProfileRow(null);
      setAllowedCategoryIds(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      const row = await loadProfile(session.user.id);
      if (cancelled || !row) return;
      if (row.role === "admin") {
        setAllowedCategoryIds(null);
      } else {
        await loadMemberGrants(session.user.id);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, loadProfile, loadMemberGrants]);

  useEffect(() => {
    if (!isOneSignalConfigured()) return;
    const uid = session?.user?.id;
    if (!uid) {
      void setOneSignalExternalUser(null);
      return;
    }
    void setOneSignalExternalUser(uid);
  }, [session?.user?.id]);

  const user = useMemo(() => {
    if (!session?.user || !profileRow) return null;
    return toAppUser(session, profileRow);
  }, [session, profileRow]);

  const authed = Boolean(session?.user && profileRow && user);
  const isAdmin = user?.role === "admin";

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    return { error: error ? error.message : null };
  }, []);

  const signOut = useCallback(async () => {
    if (isOneSignalConfigured()) {
      await setOneSignalExternalUser(null);
    }
    await supabase.auth.signOut();
    setProfileRow(null);
    setAllowedCategoryIds(null);
  }, []);

  const inviteMember = useCallback(
    async (email: string, displayName: string) => {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: {
          email: email.trim(),
          display_name: displayName.trim(),
        },
      });
      if (error) {
        return {
          error: error.message ?? "Invite failed (is the Edge Function deployed?)",
        };
      }
      const body = data as { error?: string } | null;
      if (body && typeof body.error === "string") {
        return { error: body.error };
      }
      return { error: null };
    },
    [],
  );

  const value = useMemo<AuthValue>(
    () => ({
      authReady,
      session,
      authed,
      user,
      isAdmin,
      allowedCategoryIds,
      signIn,
      signOut,
      inviteMember,
    }),
    [
      authReady,
      session,
      authed,
      user,
      isAdmin,
      allowedCategoryIds,
      signIn,
      signOut,
      inviteMember,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
