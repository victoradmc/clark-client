import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  getLessons,
  getMyNotes,
  getOwnerNames,
  getSession,
  type Lesson,
  type LessonSort,
  type MyNote,
} from "../data/clarkApi";
import { friendlyErrorMessage } from "../data/errorMessage";
import Badge from "../components/Badge";
import LessonCard from "../components/LessonCard";
import SortSelect from "../components/SortSelect";
import TabToggle from "../components/TabToggle";
import TakeNotesModal from "../components/TakeNotesModal";

type LibraryTab = "starred" | "notes";

// The starred-only counterpart to the Hub (ticket 03), now with a second
// "My Notes" tab (ticket 04) reusing TakeNotesModal — same component the
// Lesson detail page's Take Notes button opens — so editing a Note from
// either place goes through the same save path. No search box or Subject
// filter on either tab (not part of either ticket's scope), and each tab has
// its own empty state instead of the Hub's "no match" copy since an empty
// list here isn't a filter dead-end, it's "you haven't done this yet."
export default function LibraryScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<LibraryTab>("starred");

  const [sort, setSort] = useState<LessonSort>("recentlyStarred");
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [notes, setNotes] = useState<MyNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<MyNote | null>(null);

  useEffect(() => {
    getSession().then((session) => setCurrentUserId(session?.user.id ?? null));
  }, []);

  useEffect(() => {
    if (tab !== "starred") return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const data = await getLessons({ tab: "starred", sort });
        if (cancelled) return;
        setLessons(data);
        setError(null);

        const ownerIds = [...new Set(data.map((l) => l.owner_id))];
        const names = await getOwnerNames(ownerIds);
        if (!cancelled) setOwnerNames(names);
      } catch (err) {
        if (!cancelled) {
          setError(friendlyErrorMessage(err, t("library.couldNotLoad")));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Deliberately not depending on `t` — its reference changes on every
    // language switch, which would otherwise re-run this fetch mid-browse.
  }, [tab, sort]);

  const refreshNotes = useCallback(async () => {
    setNotesLoading(true);
    try {
      const data = await getMyNotes();
      setNotes(data);
      setNotesError(null);
    } catch (err) {
      setNotesError(friendlyErrorMessage(err, t("library.myNotesCouldNotLoad")));
    } finally {
      setNotesLoading(false);
    }
    // Deliberately not depending on `t` — see above.
  }, []);

  useEffect(() => {
    if (tab !== "notes") return;
    void refreshNotes();
  }, [tab, refreshNotes]);

  function ownerLabel(lesson: Lesson): string {
    if (lesson.owner_id === currentUserId) return t("common.you");
    return ownerNames[lesson.owner_id] ?? "…";
  }

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-brand mb-1.5 text-xs font-bold tracking-[.06em] uppercase">
            {t("library.eyebrow")}
          </div>
          <h1 className="text-[30px] font-extrabold tracking-[-0.02em]">
            {tab === "starred" ? t("library.title") : t("library.myNotesTitle")}
          </h1>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <TabToggle
            options={[
              { value: "starred", label: t("library.tabStarred") },
              { value: "notes", label: t("library.tabMyNotes") },
            ]}
            value={tab}
            onChange={setTab}
          />
          {tab === "starred" && (
            <SortSelect
              id="library-sort"
              label={t("library.sortLabel")}
              value={sort}
              onChange={setSort}
              options={[
                { value: "recentlyStarred", label: t("library.sortRecentlyStarred") },
                { value: "newest", label: t("library.sortNewest") },
                { value: "mostStarred", label: t("library.sortMostStarred") },
              ]}
            />
          )}
        </div>
      </div>

      {tab === "starred" && (
        <>
          {error && <p className="text-brand-dark mb-4 text-sm">{error}</p>}

          {loading && !error && (
            <p className="text-muted text-sm">{t("common.loading")}</p>
          )}

          {!loading && !error && lessons.length === 0 && (
            <p className="text-faint mt-8 text-sm">{t("library.empty")}</p>
          )}

          {!loading && lessons.length > 0 && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-[18px]">
              {lessons.map((lesson) => (
                <LessonCard
                  key={lesson.id}
                  lesson={lesson}
                  ownerLabel={ownerLabel(lesson)}
                  starred
                  isOwner={lesson.owner_id === currentUserId}
                  onOpen={() => navigate(`/lessons/${lesson.id}`)}
                  onManage={() => navigate(`/lessons/${lesson.id}/manage`)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {tab === "notes" && (
        <>
          {notesError && <p className="text-brand-dark mb-4 text-sm">{notesError}</p>}

          {notesLoading && !notesError && (
            <p className="text-muted text-sm">{t("common.loading")}</p>
          )}

          {!notesLoading && !notesError && notes.length === 0 && (
            <p className="text-faint mt-8 text-sm">{t("library.myNotesEmpty")}</p>
          )}

          {!notesLoading && notes.length > 0 && (
            <div className="grid gap-3">
              {notes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => setEditingNote(note)}
                  className="border-border-soft rounded-2xl border bg-white p-4 text-left"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[15px] font-bold tracking-[-0.01em]">
                      {note.lesson_title}
                    </div>
                    <Badge tone="brand">{note.lesson_subject}</Badge>
                  </div>
                  <p className="text-muted mt-2 line-clamp-2 text-[12.5px]">
                    {note.content}
                  </p>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {editingNote && (
        <TakeNotesModal
          lessonId={editingNote.lesson_id}
          initialContent={editingNote.content}
          onClose={() => setEditingNote(null)}
          onSaved={() => {
            setEditingNote(null);
            void refreshNotes();
          }}
        />
      )}
    </div>
  );
}
