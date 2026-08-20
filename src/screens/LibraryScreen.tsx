import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  getLessons,
  getOwnerNames,
  getSession,
  type Lesson,
  type LessonSort,
} from "../data/clarkApi";
import { friendlyErrorMessage } from "../data/errorMessage";
import LessonCard from "../components/LessonCard";
import SortSelect from "../components/SortSelect";

// The starred-only counterpart to the Hub (ticket 03) — same Lesson card
// and sort control, no search box or Subject filter (not part of this
// ticket's scope), and its own empty state instead of the Hub's "no match"
// copy since an empty starred list isn't a filter dead-end, it's "you
// haven't starred anything yet."
export default function LibraryScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [sort, setSort] = useState<LessonSort>("recentlyStarred");
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSession().then((session) => setCurrentUserId(session?.user.id ?? null));
  }, []);

  useEffect(() => {
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
  }, [sort]);

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
            {t("library.title")}
          </h1>
        </div>
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
      </div>

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
    </div>
  );
}
