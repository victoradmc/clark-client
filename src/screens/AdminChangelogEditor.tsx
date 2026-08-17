import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  createChangelogEntry,
  deleteChangelogEntry,
  getChangelogEntries,
  updateChangelogEntry,
  type ChangelogEntry,
} from "../data/clarkApi";
import { useRowActions } from "../hooks/useRowActions";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// null: form closed. "create": a blank entry being composed. An id: an
// existing entry being edited in place — same form fields either way, only
// the submit action and the id sent to clarkApi differ.
type FormMode = null | "create" | { editId: string };

export default function AdminChangelogEditor() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<ChangelogEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formMode, setFormMode] = useState<FormMode>(null);
  const [formVersion, setFormVersion] = useState("");
  const [formDate, setFormDate] = useState(today());
  const [formBody, setFormBody] = useState("");
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { errors: rowErrors, run: runRowAction } = useRowActions();

  // Derived once per render so every create-vs-edit branch below (submit
  // action, error fallback, button label) reads the same value instead of
  // repeating the `formMode && typeof formMode === "object"` narrowing.
  const editId = formMode && typeof formMode === "object" ? formMode.editId : null;

  async function loadEntries() {
    try {
      const data = await getChangelogEntries();
      setEntries(data);
      setLoadError(null);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : t("admin.help.couldNotLoadEntries"),
      );
    }
  }

  useEffect(() => {
    void loadEntries();
  }, []);

  function openCreateForm() {
    setFormMode("create");
    setFormVersion("");
    setFormDate(today());
    setFormBody("");
    setFormError(null);
  }

  function openEditForm(entry: ChangelogEntry) {
    setFormMode({ editId: entry.id });
    setFormVersion(entry.version);
    setFormDate(entry.entry_date);
    setFormBody(entry.body);
    setFormError(null);
  }

  function closeForm() {
    setFormMode(null);
  }

  async function handleFormSubmit() {
    setFormSaving(true);
    setFormError(null);
    const fields = { version: formVersion, entry_date: formDate, body: formBody };
    try {
      if (editId) {
        await updateChangelogEntry(editId, fields);
      } else {
        await createChangelogEntry(fields);
      }
      setFormMode(null);
      await loadEntries();
    } catch (err) {
      const fallback = editId
        ? t("admin.help.couldNotUpdate")
        : t("admin.help.couldNotCreate");
      setFormError(err instanceof Error ? err.message : fallback);
    } finally {
      setFormSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await runRowAction(
      id,
      async () => {
        await deleteChangelogEntry(id);
        await loadEntries();
      },
      t("admin.help.couldNotDelete"),
    );
  }

  return (
    <div className="max-w-[700px]">
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => (formMode ? closeForm() : openCreateForm())}
          className="bg-ink rounded-[11px] px-4.5 py-2.5 text-sm font-bold text-white"
        >
          {formMode ? t("common.cancel") : t("admin.help.newEntryButton")}
        </button>
      </div>

      {formMode && (
        <div className="border-border-soft mb-5 grid gap-3 rounded-2xl border bg-white p-5">
          <div className="grid grid-cols-[1fr_160px] gap-3">
            <div>
              <label className="text-label mb-1.5 block text-xs font-semibold">
                {t("admin.help.versionLabel")}
              </label>
              <input
                className="border-border w-full rounded-[10px] border px-3 py-2.5 text-[13.5px]"
                value={formVersion}
                onChange={(e) => setFormVersion(e.target.value)}
              />
            </div>
            <div>
              <label className="text-label mb-1.5 block text-xs font-semibold">
                {t("admin.help.dateLabel")}
              </label>
              <input
                type="date"
                className="border-border w-full rounded-[10px] border px-3 py-2.5 text-[13.5px]"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-label mb-1.5 block text-xs font-semibold">
              {t("admin.help.bodyLabel")}
            </label>
            <textarea
              className="border-border focus:outline-brand min-h-[140px] w-full rounded-[11px] border bg-white px-3.5 py-2.5 font-mono text-[13px] leading-relaxed focus:outline-2 focus:outline-offset-1"
              value={formBody}
              onChange={(e) => setFormBody(e.target.value)}
            />
          </div>
          {formError && (
            <p className="text-brand-dark text-[12.5px]">{formError}</p>
          )}
          <div>
            <button
              type="button"
              disabled={formSaving || !formVersion.trim() || !formDate}
              onClick={() => void handleFormSubmit()}
              className="bg-brand rounded-[10px] px-4.5 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-60"
            >
              {formSaving
                ? t("admin.help.saving")
                : editId
                  ? t("admin.help.updateButton")
                  : t("admin.help.createButton")}
            </button>
          </div>
        </div>
      )}

      {loadError && <p className="text-brand-dark mb-4 text-sm">{loadError}</p>}

      {entries === null && !loadError && (
        <p className="text-muted text-sm">{t("common.loading")}</p>
      )}

      {entries !== null && entries.length === 0 && (
        <p className="text-faint text-sm">{t("admin.help.noEntries")}</p>
      )}

      {entries !== null && entries.length > 0 && (
        <div className="grid gap-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="border-border-soft rounded-2xl border bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="bg-chip text-chip-text rounded-full px-2.5 py-1 text-[11.5px] font-bold">
                    {entry.version}
                  </span>
                  <span className="text-faint text-[12px]">{entry.entry_date}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEditForm(entry)}
                    className="border-border text-label rounded-lg border bg-white px-2.5 py-1.5 text-xs font-semibold"
                  >
                    {t("admin.help.editButton")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(entry.id)}
                    className="border-brand text-brand rounded-lg border-[1.5px] bg-white px-2.5 py-1.5 text-xs font-bold"
                  >
                    {t("admin.help.deleteButton")}
                  </button>
                </div>
              </div>
              <p className="text-muted mt-2 line-clamp-2 text-[12.5px]">
                {entry.body}
              </p>
              {rowErrors[entry.id] && (
                <p className="text-brand-dark mt-2 text-[12px]">
                  {rowErrors[entry.id]}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
