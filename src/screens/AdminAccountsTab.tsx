import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  approveAccessRequest,
  deleteAccount,
  getAccessRequests,
  getAccounts,
  inviteAccount,
  rejectAccessRequest,
  requestPasswordReset,
  updateAccountRole,
  type Account,
  type AccessRequest,
  type Role,
} from "../data/clarkApi";
import { friendlyErrorMessage } from "../data/errorMessage";
import { useRowActions } from "../hooks/useRowActions";

export default function AdminAccountsTab() {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("student");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // One useRowActions instance per distinct row action (not shared) so a
  // request in flight for one action doesn't disable an unrelated action on
  // the same row — see useRowActions.ts.
  const {
    errors: roleChangeErrors,
    pending: roleChangePending,
    run: runRoleChangeAction,
  } = useRowActions();
  const {
    errors: resetPasswordErrors,
    pending: resetPasswordPending,
    run: runResetPasswordAction,
  } = useRowActions();
  const {
    errors: deleteErrors,
    pending: deletePending,
    run: runDeleteAction,
  } = useRowActions();
  const [resetSentIds, setResetSentIds] = useState<Record<string, boolean>>({});
  // Only one Account can be armed for delete confirmation at a time —
  // clicking Delete again on a different row simply re-arms that row
  // instead, same as picking a new target.
  const [deleteConfirmingId, setDeleteConfirmingId] = useState<string | null>(
    null,
  );

  const [accessRequests, setAccessRequests] = useState<AccessRequest[] | null>(null);
  const [requestsLoadError, setRequestsLoadError] = useState<string | null>(null);
  const { errors: requestRowErrors, run: runRequestRowAction } = useRowActions();

  async function loadAccounts() {
    try {
      const data = await getAccounts();
      setAccounts(data);
      setLoadError(null);
    } catch (err) {
      setLoadError(friendlyErrorMessage(err, t("admin.accounts.couldNotLoad")));
    }
  }

  async function loadAccessRequests() {
    try {
      const data = await getAccessRequests();
      setAccessRequests(data);
      setRequestsLoadError(null);
    } catch (err) {
      setRequestsLoadError(
        friendlyErrorMessage(err, t("admin.accounts.couldNotLoadRequests")),
      );
    }
  }

  useEffect(() => {
    void loadAccounts();
    void loadAccessRequests();
  }, []);

  async function handleApprove(request: AccessRequest) {
    await runRequestRowAction(
      request.id,
      async () => {
        await approveAccessRequest(request);
        await Promise.all([loadAccessRequests(), loadAccounts()]);
      },
      t("admin.accounts.couldNotApprove"),
    );
  }

  async function handleReject(id: string) {
    await runRequestRowAction(
      id,
      async () => {
        await rejectAccessRequest(id);
        await loadAccessRequests();
      },
      t("admin.accounts.couldNotReject"),
    );
  }

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
      setInviteError(friendlyErrorMessage(err, t("admin.accounts.couldNotInvite")));
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(id: string, role: Role) {
    await runRoleChangeAction(
      id,
      async () => {
        await updateAccountRole(id, role);
        await loadAccounts();
      },
      t("admin.accounts.couldNotChangeRole"),
    );
  }

  async function handleResetPassword(account: Account) {
    await runResetPasswordAction(
      account.id,
      async () => {
        await requestPasswordReset(account.email);
        setResetSentIds((prev) => ({ ...prev, [account.id]: true }));
        setTimeout(() => {
          setResetSentIds((prev) => ({ ...prev, [account.id]: false }));
        }, 2000);
      },
      t("admin.accounts.couldNotSendReset"),
    );
  }

  async function handleDelete(id: string) {
    if (deleteConfirmingId !== id) {
      setDeleteConfirmingId(id);
      return;
    }
    setDeleteConfirmingId(null);
    await runDeleteAction(
      id,
      async () => {
        await deleteAccount(id);
        await loadAccounts();
      },
      t("admin.accounts.couldNotDelete"),
    );
  }

  return (
    <div>
      {requestsLoadError && (
        <p className="text-brand-dark mb-4 text-sm">{requestsLoadError}</p>
      )}

      {accessRequests !== null && accessRequests.length > 0 && (
        <div className="mb-6">
          <div className="text-faint mb-2.5 text-[11.5px] font-bold tracking-[.04em] uppercase">
            {t("admin.accounts.pendingRequestsTitle")}
          </div>
          <div className="grid gap-3">
            {accessRequests.map((request) => (
              <div
                key={request.id}
                className="border-border-soft rounded-2xl border bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[13.5px] font-semibold">{request.name}</div>
                    <div className="text-muted text-[12.5px]">{request.email}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleApprove(request)}
                      className="bg-brand rounded-lg px-3 py-1.5 text-xs font-bold text-white"
                    >
                      {t("admin.accounts.approve")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleReject(request.id)}
                      className="border-brand text-brand rounded-lg border-[1.5px] bg-white px-3 py-1.5 text-xs font-bold"
                    >
                      {t("admin.accounts.reject")}
                    </button>
                  </div>
                </div>
                {request.message && (
                  <p className="text-muted mt-2 text-[12.5px]">{request.message}</p>
                )}
                {requestRowErrors[request.id] && (
                  <p className="text-brand-dark mt-2 text-[12px]">
                    {requestRowErrors[request.id]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap justify-between gap-3">
        <input
          className="border-border focus:outline-brand min-w-[220px] flex-1 rounded-[11px] border bg-white px-3.5 py-2.5 text-sm focus:outline-2 focus:outline-offset-1"
          placeholder={t("admin.accounts.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setShowInviteForm((v) => !v)}
          className="bg-ink rounded-[11px] px-4.5 py-2.5 text-sm font-bold text-white"
        >
          {showInviteForm ? t("common.cancel") : t("admin.accounts.inviteButton")}
        </button>
      </div>

      {showInviteForm && (
        <div className="border-border-soft mb-4 grid grid-cols-[1fr_1fr_140px_auto] items-end gap-3 rounded-2xl border bg-white p-5">
          <div>
            <label className="text-label mb-1.5 block text-xs font-semibold">
              {t("admin.accounts.nameLabel")}
            </label>
            <input
              className="border-border w-full rounded-[10px] border px-3 py-2.5 text-[13.5px]"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-label mb-1.5 block text-xs font-semibold">
              {t("admin.accounts.emailLabel")}
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
              {t("admin.accounts.roleLabel")}
            </label>
            <select
              className="border-border w-full rounded-[10px] border px-3 py-2.5 text-[13.5px]"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as Role)}
            >
              <option value="student">{t("admin.accounts.roleStudent")}</option>
              <option value="admin">{t("admin.accounts.roleAdmin")}</option>
            </select>
          </div>
          <button
            type="button"
            disabled={inviting || !inviteName.trim() || !inviteEmail.trim()}
            onClick={() => void handleInvite()}
            className="bg-brand rounded-[10px] px-4.5 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-60"
          >
            {inviting ? t("admin.accounts.inviting") : t("admin.accounts.createButton")}
          </button>
          {inviteError && (
            <p className="text-brand-dark col-span-full text-[12.5px]">
              {inviteError}
            </p>
          )}
        </div>
      )}

      {loadError && <p className="text-brand-dark mb-4 text-sm">{loadError}</p>}

      {!loadError && accounts === null && (
        <p className="text-muted text-sm">{t("common.loading")}</p>
      )}

      {accounts !== null && (
        <>
          <div className="border-border-soft overflow-hidden rounded-2xl border bg-white">
            <div className="text-faint grid grid-cols-[1.4fr_1.6fr_130px_130px_220px] gap-2.5 border-b border-[#EEEEEC] px-5 py-3 text-[11.5px] font-bold tracking-[.04em] uppercase">
              <span>{t("admin.accounts.columnName")}</span>
              <span>{t("admin.accounts.columnEmail")}</span>
              <span>{t("admin.accounts.columnRole")}</span>
              <span>{t("admin.accounts.columnStatus")}</span>
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
                  className="border-border rounded-lg border px-2 py-1.5 text-[12.5px] disabled:opacity-60"
                  value={account.role}
                  disabled={roleChangePending[account.id]}
                  onChange={(e) =>
                    void handleRoleChange(account.id, e.target.value as Role)
                  }
                >
                  <option value="student">{t("admin.accounts.roleStudent")}</option>
                  <option value="admin">{t("admin.accounts.roleAdmin")}</option>
                </select>
                <span
                  className={`w-fit rounded-full px-2.5 py-1 text-[11.5px] font-bold ${
                    account.status === "active"
                      ? "bg-[#DBF3E3] text-[#1D7A3E]"
                      : "bg-chip text-chip-text"
                  }`}
                >
                  {account.status === "active"
                    ? t("admin.accounts.statusActive")
                    : t("admin.accounts.statusInvited")}
                </span>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={resetPasswordPending[account.id]}
                    onClick={() => void handleResetPassword(account)}
                    className="border-border rounded-lg border bg-white px-2.5 py-1.5 text-xs font-semibold disabled:opacity-60"
                  >
                    {resetSentIds[account.id]
                      ? t("admin.accounts.resetSent")
                      : t("admin.accounts.resetPassword")}
                  </button>
                  <button
                    type="button"
                    disabled={deletePending[account.id]}
                    onClick={() => void handleDelete(account.id)}
                    className="border-brand text-brand rounded-lg border-[1.5px] bg-white px-2.5 py-1.5 text-xs font-bold disabled:opacity-60"
                  >
                    {deletePending[account.id]
                      ? t("admin.accounts.deleting")
                      : deleteConfirmingId === account.id
                        ? t("admin.accounts.confirmDelete")
                        : t("admin.accounts.delete")}
                  </button>
                </div>
                {(roleChangeErrors[account.id] ||
                  resetPasswordErrors[account.id] ||
                  deleteErrors[account.id]) && (
                  <p className="text-brand-dark col-span-full text-[12px]">
                    {roleChangeErrors[account.id] ||
                      resetPasswordErrors[account.id] ||
                      deleteErrors[account.id]}
                  </p>
                )}
              </div>
            ))}
          </div>
          {visibleAccounts.length === 0 && (
            <p className="text-faint mt-6 text-sm">{t("admin.accounts.noMatch")}</p>
          )}
        </>
      )}
    </div>
  );
}
