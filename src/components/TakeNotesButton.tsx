import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getMyNote } from "../data/clarkApi";
import { friendlyErrorMessage } from "../data/errorMessage";
import TakeNotesModal from "./TakeNotesModal";

// Lesson detail page only (spec: absent from every Lesson card in list
// views) — a fixed-position button, self-contained like StarButton and
// CommentSection, that fetches the caller's own Note on mount and owns the
// modal's open state; TakeNotesModal (shared with the My Notes tab, ticket
// 04) owns the draft/save state. The button's label and the modal's pre-fill
// both key off `noteContent`, which is null until a Note exists.
export default function TakeNotesButton({ lessonId }: { lessonId: string }) {
  const { t } = useTranslation();
  const [noteContent, setNoteContent] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  // Unlike StarButton/CommentSection's mount fetches, a failure here can't
  // just fall back to an empty default: saveNote is a blind upsert, so
  // silently treating a failed lookup as "no Note yet" would let a save
  // overwrite — and lose — an existing Note the caller never saw. The
  // button surfaces the error and stays disabled instead.
  useEffect(() => {
    let cancelled = false;
    getMyNote(lessonId)
      .then((note) => {
        if (!cancelled) setNoteContent(note?.content ?? null);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(friendlyErrorMessage(err, t("notes.couldNotLoad")));
      });
    return () => {
      cancelled = true;
    };
    // Deliberately not depending on `t` — see HubScreen.tsx for why.
  }, [lessonId]);

  function openModal() {
    if (loadError) return;
    setOpen(true);
  }

  return (
    <>
      <div className="fixed right-6 bottom-6 z-30 flex flex-col items-end gap-1.5">
        {loadError && (
          <span className="text-brand-dark max-w-[220px] rounded-[10px] bg-white px-3 py-1.5 text-right text-[11.5px] font-semibold shadow-[0_4px_12px_rgba(16,24,32,.12)]">
            {loadError}
          </span>
        )}
        <button
          type="button"
          onClick={openModal}
          disabled={!!loadError}
          className="bg-brand rounded-full px-5 py-3 text-sm font-bold text-white shadow-[0_8px_20px_rgba(232,84,42,.28)] disabled:opacity-60"
        >
          {noteContent !== null ? t("notes.editButton") : t("notes.takeButton")}
        </button>
      </div>

      {open && (
        <TakeNotesModal
          lessonId={lessonId}
          initialContent={noteContent ?? ""}
          onClose={() => setOpen(false)}
          onSaved={(saved) => setNoteContent(saved?.content ?? null)}
        />
      )}
    </>
  );
}
