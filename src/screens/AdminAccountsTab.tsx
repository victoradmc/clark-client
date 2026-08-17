import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  createAccount,
  deleteAccount,
  getAccounts,
  requestPasswordReset,
  updateAccountRole,
  type Account,
  type Role,
} from "../data/clarkApi";
import { friendlyErrorMessage } from "../data/errorMessage";
import { MIN_PASSWORD_LENGTH } from "../data/registerValidation";
import { useRowActions } from "../hooks/useRowActions";

export default function AdminAccountsTab() {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState<Role>("student");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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

  async function loadAccounts() {
    try {
      const data = await getAccounts();
      setAccounts(data);
      setLoadError(null);
    } catch (err) {
      setLoadError(friendlyErrorMessage(err, t("admin.accounts.couldNotLoad")));
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

  async function handleCreate() {
    setCreateError(null);
    if (createPassword.length < MIN_PASSWORD_LENGTH) {
      setCreateError(t("admin.accounts.passwordTooShort", { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    setCreating(true);
    try {
      await createAccount({
        name: createName,
        email: createEmail,
        password: createPassword,
        role: createRole,
      });
      setCreateName("");
      setCreateEmail("");
      setCreatePassword("");
      setCreateRole("student");
      setShowCreateForm(false);
      await loadAccounts();
    } catch (err) {
      setCreateError(friendlyErrorMessage(err, t("admin.accounts.couldNotCreate")));
    } finally {
      setCreating(false);
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
      <div className="mb-4 flex flex-wrap justify-between gap-3">
        <input
          className="border-border focus:outline-brand min-w-[220px] flex-1 rounded-[11px] border bg-white px-3.5 py-2.5 text-sm focus:outline-2 focus:outline-offset-1"
          placeholder={t("admin.accounts.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setShowCreateForm((v) => !v)}
          className="bg-ink rounded-[11px] px-4.5 py-2.5 text-sm font-bold text-white"
        >
          {showCreateForm ? t("common.cancel") : t("admin.accounts.addAccountButton")}
        </button>
      </div>

      {showCreateForm && (
        <div className="border-border-soft mb-4 grid grid-cols-[1fr_1fr_140px] gap-3 rounded-2xl border bg-white p-5">
          <div>
            <label className="text-label mb-1.5 block text-xs font-semibold">
              {t("admin.accounts.nameLabel")}
            </label>
            <input
              className="border-border w-full rounded-[10px] border px-3 py-2.5 text-[13.5px]"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-label mb-1.5 block text-xs font-semibold">
              {t("admin.accounts.emailLabel")}
            </label>
            <input
              type="email"
              className="border-border w-full rounded-[10px] border px-3 py-2.5 text-[13.5px]"
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="text-label mb-1.5 block text-xs font-semibold">
              {t("admin.accounts.roleLabel")}
            </label>
            <select
              className="border-border w-full rounded-[10px] border px-3 py-2.5 text-[13.5px]"
              value={createRole}
              onChange={(e) => setCreateRole(e.target.value as Role)}
            >
              <option value="student">{t("admin.accounts.roleStudent")}</option>
              <option value="admin">{t("admin.accounts.roleAdmin")}</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-label mb-1.5 block text-xs font-semibold">
              {t("admin.accounts.passwordLabel")}
            </label>
            <input
              type="password"
              autoComplete="new-password"
              className="border-border w-full rounded-[10px] border px-3 py-2.5 text-[13.5px]"
              value={createPassword}
              onChange={(e) => setCreatePassword(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              disabled={creating || !createName.trim() || !createEmail.trim() || !createPassword}
              onClick={() => void handleCreate()}
              className="bg-brand w-full rounded-[10px] px-4.5 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-60"
            >
              {creating ? t("admin.accounts.creating") : t("admin.accounts.createButton")}
            </button>
          </div>
          {createError && (
            <p className="text-brand-dark col-span-full text-[12.5px]">
              {createError}
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
            <div className="text-faint grid grid-cols-[1.4fr_1.6fr_130px_130px_220px] gap-2.5 border-b border-[#EEEEEC] px-5 py-3 text-[11.5px] font-bold tracking-[.04em] uppercase max-md:hidden">
              <span>{t("admin.accounts.columnName")}</span>
              <span>{t("admin.accounts.columnEmail")}</span>
              <span>{t("admin.accounts.columnRole")}</span>
              <span>{t("admin.accounts.columnStatus")}</span>
              <span></span>
            </div>
            {visibleAccounts.map((account) => (
              <div
                key={account.id}
                className="grid grid-cols-[1.4fr_1.6fr_130px_130px_220px] items-center gap-2.5 border-b border-[#F3F3F1] px-5 py-3.5 text-[13.5px] last:border-b-0 max-md:grid-cols-1 max-md:items-start max-md:gap-1.5 max-md:py-4"
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
