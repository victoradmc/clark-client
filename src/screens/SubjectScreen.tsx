import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  getLessonsForSubject,
  getMyStarredLessonIds,
  getOwnerNames,
  getSession,
  type Lesson,
} from "../data/clarkApi";
import { friendlyErrorMessage } from "../data/errorMessage";
import LessonCard from "../components/LessonCard";

// A narrower Hub scoped to one Subject (ticket 02), reached by clicking a
// Home subject card. Same Public+own visibility rule as the Hub's combined
// view, newest-first, no search/sort controls (see ADR 0010). `:name` is
// whatever the clicked card's original-casing label URL-encoded to — an
// unrecognized or empty Subject just matches zero Lessons server-side
// (getLessonsForSubject), rendered here as an empty state, never a redirect
// or an error (spec story 15).
export default function SubjectScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { name } = useParams<{ name: string }>();
  const subject = name ? decodeURIComponent(name) : "";
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const session = await getSession();
        if (cancelled) return;
        setCurrentUserId(session?.user.id ?? null);

        const data = await getLessonsForSubject(subject);
        if (cancelled) return;
        setLessons(data);
        setError(null);

        const ownerIds = [...new Set(data.map((l) => l.owner_id))];
        const names = await getOwnerNames(ownerIds);
        if (!cancelled) setOwnerNames(names);

        const starred = await getMyStarredLessonIds(data.map((l) => l.id));
        if (!cancelled) setStarredIds(starred);
      } catch (err) {
        if (!cancelled) {
          setError(friendlyErrorMessage(err, t("subject.couldNotLoad")));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Deliberately not depending on `t` — see HubScreen.tsx for why.
  }, [subject]);

  function ownerLabel(lesson: Lesson): string {
    if (lesson.owner_id === currentUserId) return t("common.you");
    return ownerNames[lesson.owner_id] ?? "…";
  }

  return (
    <div>
      <Link
        to="/"
        className="text-muted mb-5 inline-block text-[13.5px] font-semibold no-underline"
      >
        {t("subject.backToHome")}
      </Link>

      <div className="mb-7">
        <div className="text-brand mb-1.5 text-xs font-bold tracking-[.06em] uppercase">
          {t("subject.eyebrow")}
        </div>
        <h1 className="text-[30px] font-extrabold tracking-[-0.02em]">{subject}</h1>
        {!loading && !error && (
          <p className="text-muted mt-1.5 text-sm">
            {t("subject.lessonCount", { count: lessons.length })}
          </p>
        )}
      </div>

      {error && <p className="text-brand-dark mb-4 text-sm">{error}</p>}

      {loading && !error && (
        <p className="text-muted text-sm">{t("common.loading")}</p>
      )}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-[18px]">
            {lessons.map((lesson) => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                ownerLabel={ownerLabel(lesson)}
                starred={starredIds.has(lesson.id)}
                isOwner={lesson.owner_id === currentUserId}
                onOpen={() => navigate(`/lessons/${lesson.id}`)}
                onManage={() => navigate(`/lessons/${lesson.id}/manage`)}
              />
            ))}
          </div>

          {lessons.length === 0 && (
            <p className="text-faint mt-8 text-sm">{t("subject.empty")}</p>
          )}
        </>
      )}
    </div>
  );
}
