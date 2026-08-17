import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getHelpTutorial, updateHelpTutorial } from "../data/clarkApi";
import { friendlyErrorMessage } from "../data/errorMessage";

export default function AdminTutorialEditor() {
  const { t } = useTranslation();
  const [content, setContent] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getHelpTutorial()
      .then((tutorial) => {
        if (!cancelled) setContent(tutorial.content);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(friendlyErrorMessage(err, t("admin.help.couldNotLoad")));
        }
      });
    return () => {
      cancelled = true;
    };
    // Deliberately not depending on `t` — see HubScreen.tsx for why.
  }, []);

  async function handleSave() {
    if (content === null) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const updated = await updateHelpTutorial(content);
      setContent(updated.content);
      setSaved(true);
    } catch (err) {
      setSaveError(friendlyErrorMessage(err, t("admin.help.couldNotSave")));
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return <p className="text-brand-dark text-sm">{loadError}</p>;
  }

  if (content === null) {
    return <p className="text-muted text-sm">{t("common.loading")}</p>;
  }

  return (
    <div className="max-w-[700px]">
      <label className="text-label mb-1.5 block text-[12.5px] font-semibold">
        {t("admin.help.tutorialLabel")}
      </label>
      <textarea
        className="border-border focus:outline-brand min-h-[320px] w-full rounded-[11px] border bg-white px-3.5 py-2.5 font-mono text-[13px] leading-relaxed focus:outline-2 focus:outline-offset-1"
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          setSaved(false);
        }}
      />

      {saveError && (
        <p className="text-brand-dark mt-3 text-[13px]">{saveError}</p>
      )}
      {saved && !saveError && (
        <p className="mt-3 text-[13px] font-semibold text-[#1D7A3E]">
          {t("admin.help.saved")}
        </p>
      )}

      <div className="mt-4 flex gap-2.5">
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="bg-brand rounded-[11px] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {saving ? t("admin.help.saving") : t("admin.help.saveChanges")}
        </button>
      </div>
    </div>
  );
}
