import { useState } from "react";
import { CheckCircle2, Lock, Mail } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { APP_NAME } from "../lib/constants";

export function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) {
      setErr(error);
      setPassword("");
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-neutral-50 dark:bg-neutral-950">
      <div className="tm-card w-full max-w-md p-8 tm-fade">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-neutral-900 dark:bg-white flex items-center justify-center">
            <CheckCircle2
              className="w-6 h-6 text-green-400 dark:text-green-500"
              strokeWidth={2.5}
            />
          </div>
          <div>
            <div className="text-xs font-semibold tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
              {APP_NAME}
            </div>
            <div className="text-base font-semibold text-neutral-900 dark:text-white">
              Sign in
            </div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Email
            </span>
            <div className="relative mt-2">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
              <input
                autoFocus
                autoComplete="email"
                type="email"
                className="tm-input pl-12"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Password
            </span>
            <div className="relative mt-2">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
              <input
                autoComplete="current-password"
                type="password"
                className="tm-input pl-12"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </label>
          {err && (
            <div className="text-sm text-red-500 font-medium">{err}</div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="tm-btn-primary w-full disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}
