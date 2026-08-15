import { useEffect, useMemo, useState } from "react";
import {
  deleteAccount,
  getAccounts,
  inviteAccount,
  requestPasswordReset,
  updateAccountRole,
  type Account,
  type Role,
} from "../data/clarkApi";
import { useRowActions } from "../hooks/useRowActions";

export default function AdminAccountsTab() {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("student");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const { errors: rowErrors, run: runRowAction } = useRowActions();
  const [resetSentIds, setResetSentIds] = useState<Record<string, boolean>>({});

  async function loadAccounts() {
    try {
      const data = await getAccounts();
      setAccounts(data);
      setLoadError(null);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Could not load Accounts.",
      );
    }
  }

  useEffect(() => {
    void loadAccounts();
  }, []);

  const visibleAccounts = useMemo(() => {
    if (!accounts) return [];
    const term = search.trim().toLowerCase();
    if (!term) return accounts;
    return accounts.filter(
      (a) =>
        a.name.toLowerCase().includes(term) ||
        a.email.toLowerCase().includes(term),
    );
  }, [accounts, search]);

  async function handleInvite() {
    setInviting(true);
    setInviteError(null);
    try {
      await inviteAccount({ name: inviteName, email: inviteEmail, role: inviteRole });
      setInviteName("");
      setInviteEmail("");
      setInviteRole("student");
      setShowInviteForm(false);
      await loadAccounts();
    } catch (err) {
      setInviteError(
        err instanceof Error ? err.message : "Could not invite this Account.",
      );
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(id: string, role: Role) {
    await runRowAction(
      id,
      async () => {
        await updateAccountRole(id, role);
        await loadAccounts();
      },
      "Could not change this Role.",
    );
  }

  async function handleResetPassword(account: Account) {
    await runRowAction(
      account.id,
      async () => {
        await requestPasswordReset(account.email);
        setResetSentIds((prev) => ({ ...prev, [account.id]: true }));
        setTimeout(() => {
          setResetSentIds((prev) => ({ ...prev, [account.id]: false }));
        }, 2000);
      },
      "Could not send a reset email.",
    );
  }

  async function handleDelete(id: string) {
    await runRowAction(
      id,
      async () => {
        await deleteAccount(id);
        await loadAccounts();
      },
      "Could not delete this Account.",
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap justify-between gap-3">
        <input
          className="border-border focus:outline-brand min-w-[220px] flex-1 rounded-[11px] border bg-white px-3.5 py-2.5 text-sm focus:outline-2 focus:outline-offset-1"
          placeholder="Search accounts by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setShowInviteForm((v) => !v)}
          className="bg-ink rounded-[11px] px-4.5 py-2.5 text-sm font-bold text-white"
        >
          {showInviteForm ? "Cancel" : "Invite Account"}
        </button>
      </div>

      {showInviteForm && (
        <div className="border-border-soft mb-4 grid grid-cols-[1fr_1fr_140px_auto] items-end gap-3 rounded-2xl border bg-white p-5">
          <div>
            <label className="text-label mb-1.5 block text-xs font-semibold">
              Name
            </label>
            <input
              className="border-border w-full rounded-[10px] border px-3 py-2.5 text-[13.5px]"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-label mb-1.5 block text-xs font-semibold">
              Email
            </label>
            <input
              type="email"
              className="border-border w-full rounded-[10px] border px-3 py-2.5 text-[13.5px]"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="text-label mb-1.5 block text-xs font-semibold">
              Role
            </label>
            <select
              className="border-border w-full rounded-[10px] border px-3 py-2.5 text-[13.5px]"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as Role)}
            >
              <option value="student">Student</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button
            type="button"
            disabled={inviting || !inviteName.trim() || !inviteEmail.trim()}
            onClick={() => void handleInvite()}
            className="bg-brand rounded-[10px] px-4.5 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-60"
          >
            {inviting ? "Inviting…" : "Create"}
          </button>
          {inviteError && (
            <p className="text-brand-dark col-span-full text-[12.5px]">
              {inviteError}
            </p>
          )}
        </div>
      )}

      {loadError && <p className="text-brand-dark mb-4 text-sm">{loadError}</p>}

      <div className="border-border-soft overflow-hidden rounded-2xl border bg-white">
        <div className="text-faint grid grid-cols-[1.4fr_1.6fr_130px_130px_220px] gap-2.5 border-b border-[#EEEEEC] px-5 py-3 text-[11.5px] font-bold tracking-[.04em] uppercase">
          <span>Name</span>
          <span>Email</span>
          <span>Role</span>
          <span>Status</span>
          <span></span>
        </div>
        {visibleAccounts.map((account) => (
          <div
            key={account.id}
            className="grid grid-cols-[1.4fr_1.6fr_130px_130px_220px] items-center gap-2.5 border-b border-[#F3F3F1] px-5 py-3.5 text-[13.5px] last:border-b-0"
          >
            <span className="font-semibold">{account.name}</span>
            <span className="text-muted">{account.email}</span>
            <select
              className="border-border rounded-lg border px-2 py-1.5 text-[12.5px]"
              value={account.role}
              onChange={(e) => void handleRoleChange(account.id, e.target.value as Role)}
            >
              <option value="student">Student</option>
              <option value="admin">Admin</option>
            </select>
            <span
              className={`w-fit rounded-full px-2.5 py-1 text-[11.5px] font-bold ${
                account.status === "active"
                  ? "bg-[#DBF3E3] text-[#1D7A3E]"
                  : "bg-chip text-chip-text"
              }`}
            >
              {account.status === "active" ? "Active" : "Invited"}
            </span>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => void handleResetPassword(account)}
                className="border-border rounded-lg border bg-white px-2.5 py-1.5 text-xs font-semibold"
              >
                {resetSentIds[account.id] ? "Sent!" : "Reset password"}
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(account.id)}
                className="border-brand text-brand rounded-lg border-[1.5px] bg-white px-2.5 py-1.5 text-xs font-bold"
              >
                Delete
              </button>
            </div>
            {rowErrors[account.id] && (
              <p className="text-brand-dark col-span-full text-[12px]">
                {rowErrors[account.id]}
              </p>
            )}
          </div>
        ))}
      </div>
      {visibleAccounts.length === 0 && (
        <p className="text-faint mt-6 text-sm">No accounts match.</p>
      )}
    </div>
  );
}
