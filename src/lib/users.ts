export type UserRole = "admin" | "member";

/** Mirrors `public.profiles` + session email (no passwords in the client). */
export interface AppUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
}
