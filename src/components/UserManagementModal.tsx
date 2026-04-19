import { useCallback, useEffect, useMemo, useState } from "react";
import { UserPlus } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { supabase } from "../lib/supabase";
import type { AppUser } from "../lib/users";
import { Modal } from "./Modal";
import { CategoryIcon } from "./CategoryIcon";
import { cx, hexAlpha } from "../lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function UserManagementModal({ open, onClose }: Props) {
  const { isAdmin, inviteMember } = useAuth();
  const { categories } = useData();

  const [members, setMembers] = useState<AppUser[]>([]);
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteErr, setInviteErr] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);

  const sortedCats = useMemo(
    () => [...categories].sort((a, b) => a.position - b.position),
    [categories],
  );

  const reloadMembersAndGrants = useCallback(async () => {
    const { data: profs, error: pErr } = await supabase
      .from("profiles")
      .select("id, email, display_name, role")
      .eq("role", "member")
      .order("display_name");

    if (pErr || !profs) {
      setMembers([]);
      setDraft({});
      return;
    }

    const memberList: AppUser[] = profs.map((p) => {
      const email = p.email ?? "";
      return {
        id: p.id,
        email,
        displayName:
          p.display_name?.trim() ||
          (email.includes("@") ? email.split("@")[0] : email) ||
          "Member",
        role: "member",
      };
    });
    setMembers(memberList);

    const { data: grants, error: gErr } = await supabase
      .from("user_category_access")
      .select("user_id, category_id");

    const map: Record<string, string[]> = {};
    for (const m of memberList) map[m.id] = [];
    if (!gErr && grants) {
      for (const g of grants) {
        const uid = g.user_id as string;
        const cid = g.category_id as string;
        if (!map[uid]) map[uid] = [];
        map[uid].push(cid);
      }
    }
    setDraft(map);
  }, []);

  useEffect(() => {
    if (!open || !isAdmin) return;
    let cancel = false;
    void (async () => {
      setLoading(true);
      await reloadMembersAndGrants();
      if (!cancel) setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [open, isAdmin, reloadMembersAndGrants]);

  const toggle = (memberId: string, categoryId: string) => {
    setDraft((d) => {
      const cur = new Set(d[memberId] ?? []);
      if (cur.has(categoryId)) cur.delete(categoryId);
      else cur.add(categoryId);
      return { ...d, [memberId]: Array.from(cur) };
    });
  };

  const onSave = async () => {
    for (const m of members) {
      const ids = draft[m.id] ?? [];
      const { error: delErr } = await supabase
        .from("user_category_access")
        .delete()
        .eq("user_id", m.id);
      if (delErr) {
        alert(delErr.message);
        return;
      }
      if (ids.length > 0) {
        const { error: insErr } = await supabase
          .from("user_category_access")
          .insert(ids.map((category_id) => ({ user_id: m.id, category_id })));
        if (insErr) {
          alert(insErr.message);
          return;
        }
      }
    }
    onClose();
  };

  const onInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteErr(null);
    setInviteBusy(true);
    const { error } = await inviteMember(inviteEmail, inviteName);
    setInviteBusy(false);
    if (error) {
      setInviteErr(error);
      return;
    }
    setInviteEmail("");
    setInviteName("");
    await reloadMembersAndGrants();
  };

  return (
    <Modal open={open} onClose={onClose} title="User access">
      <div className="p-6 space-y-8 max-h-[65vh] overflow-y-auto">
        <section>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-2">
            Invite member
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
            Sends an email invite (no public sign-up). They choose a password from the
            link. Requires the <code className="text-xs">invite-user</code> Edge Function
            deployed to this Supabase project.
          </p>
          <form onSubmit={onInvite} className="flex flex-col md:flex-row gap-2">
            <input
              type="email"
              required
              placeholder="email@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="tm-input flex-1"
            />
            <input
              type="text"
              placeholder="Display name"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              className="tm-input flex-1 md:max-w-[200px]"
            />
            <button
              type="submit"
              disabled={inviteBusy}
              className="tm-btn-primary whitespace-nowrap"
            >
              <UserPlus className="w-4 h-4" /> Invite
            </button>
          </form>
          {inviteErr && (
            <p className="text-sm text-red-500 mt-2">{inviteErr}</p>
          )}
        </section>

        <section>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-1">
            Category access
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            Members only see categories you enable here. Admins always have full access.
          </p>

          {loading ? (
            <p className="text-sm text-neutral-500">Loading…</p>
          ) : sortedCats.length === 0 ? (
            <p className="text-sm text-neutral-500">Create categories first.</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-neutral-500">No member accounts yet.</p>
          ) : (
            members.map((m) => (
              <div key={m.id} className="mb-6 last:mb-0">
                <div className="text-sm font-semibold text-neutral-900 dark:text-white mb-2">
                  {m.displayName}
                  <span className="font-normal text-neutral-500 ml-2">{m.email}</span>
                </div>
                <div className="space-y-2 rounded-xl border border-neutral-200 dark:border-neutral-800 p-3">
                  {sortedCats.map((c) => {
                    const checked = (draft[m.id] ?? []).includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className={cx(
                          "flex items-center gap-3 rounded-lg px-2 py-2 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900/80",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(m.id, c.id)}
                          className="rounded border-neutral-300 dark:border-neutral-600"
                        />
                        <span
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: hexAlpha(c.color, 0.15),
                            color: c.color,
                          }}
                        >
                          <CategoryIcon
                            name={c.icon}
                            className="w-4 h-4"
                            strokeWidth={2.2}
                          />
                        </span>
                        <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                          {c.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </section>
      </div>

      <div className="flex justify-end gap-2 px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/40">
        <button type="button" onClick={onClose} className="tm-btn-subtle">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={members.length === 0 || sortedCats.length === 0}
          className="tm-btn-primary"
        >
          Save access
        </button>
      </div>
    </Modal>
  );
}
