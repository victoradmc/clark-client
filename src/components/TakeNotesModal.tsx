import { useState } from "react";
import { useTranslation } from "react-i18next";
import { saveNote, type LessonNote } from "../data/clarkApi";
import { friendlyErrorMessage } from "../data/errorMessage";

// Extracted out of TakeNotesButton (ticket 03) so the My Notes tab (ticket
// 04) can reopen the same modal from a Note row, not just from the Lesson
// detail page's fixed button — the two callers differ only in how they
// learn the lessonId/initial text and what they do once saveNote resolves.
export default function TakeNotesModal({
  lessonId,
  initialContent,
  onClose,
  onSaved,
}: {
  lessonId: string;
  initialContent: string;
  onClose: () => void;
  onSaved: (note: LessonNote | null) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await saveNote(lessonId, draft);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(friendlyErrorMessage(err, t("notes.couldNotSave")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[520px] rounded-[18px] bg-white p-6 shadow-[0_20px_40px_rgba(16,24,32,.16)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-[17px] font-extrabold tracking-[-0.01em]">
          {t("notes.modalTitle")}
        </h2>
        <label htmlFor="note-textarea" className="sr-only">
          {t("notes.textareaLabel")}
        </label>
        <textarea
          id="note-textarea"
          autoFocus
          className="border-border focus:outline-brand min-h-[160px] w-full rounded-[11px] border bg-white px-3.5 py-2.5 text-sm leading-relaxed focus:outline-2 focus:outline-offset-1"
          placeholder={t("notes.textareaPlaceholder")}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        {error && <p className="text-brand-dark mt-2 text-[12.5px]">{error}</p>}
        <div className="mt-4 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="border-border text-label rounded-[11px] border bg-white px-4 py-2.5 text-sm font-semibold"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="bg-brand rounded-[11px] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {saving ? t("notes.saving") : t("notes.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
