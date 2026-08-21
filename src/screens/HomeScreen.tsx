import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  getLessons,
  getMyStarredLessonIds,
  getOwnerNames,
  getSession,
  getSubjectSummaries,
  type Lesson,
  type SubjectSummary,
} from "../data/clarkApi";
import { friendlyErrorMessage } from "../data/errorMessage";
import LessonCard from "../components/LessonCard";
import SubjectCard from "../components/SubjectCard";

// The new landing page at `/` (ticket 01) — built entirely on the existing
// getLessons data path: "Latest on Clark" is getLessons({tab: "public"})'s
// first (newest) row, "Your last upload" is getLessons({tab: "mine"})'s
// first row, regardless of Visibility. No new clarkApi function needed —
// both are already sorted newest-first by getLessons' trailing
// created_at order.
export default function HomeScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [latestPublic, setLatestPublic] = useState<Lesson | null>(null);
  const [yourUpload, setYourUpload] = useState<Lesson | null>(null);
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
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
        const userId = session?.user.id ?? null;
        setCurrentUserId(userId);

        const [publicLessons, myLessons, subjectSummaries] = await Promise.all([
          getLessons({ tab: "public", sort: "newest" }),
          getLessons({ tab: "mine", sort: "newest" }),
          getSubjectSummaries(),
        ]);
        if (cancelled) return;

        const latest = publicLessons[0] ?? null;
        const mine = myLessons[0] ?? null;
        setLatestPublic(latest);
        setYourUpload(mine);
        setSubjects(subjectSummaries);
        setError(null);

        const ownerIds = [...new Set([latest, mine].flatMap((l) => (l ? [l.owner_id] : [])))];
        const names = await getOwnerNames(ownerIds);
        if (!cancelled) setOwnerNames(names);

        const lessonIds = [latest, mine].flatMap((l) => (l ? [l.id] : []));
        const starred = await getMyStarredLessonIds(lessonIds);
        if (!cancelled) setStarredIds(starred);
      } catch (err) {
        if (!cancelled) {
          setError(friendlyErrorMessage(err, t("home.couldNotLoad")));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Deliberately not depending on `t` — see HubScreen.tsx for why.
  }, []);

  function ownerLabel(lesson: Lesson): string {
    if (lesson.owner_id === currentUserId) return t("common.you");
    return ownerNames[lesson.owner_id] ?? "…";
  }

  function renderCard(lesson: Lesson, eyebrow: string) {
    return (
      <LessonCard
        lesson={lesson}
        ownerLabel={ownerLabel(lesson)}
        starred={starredIds.has(lesson.id)}
        isOwner={lesson.owner_id === currentUserId}
        onOpen={() => navigate(`/lessons/${lesson.id}`)}
        onManage={() => navigate(`/lessons/${lesson.id}/manage`)}
        eyebrow={eyebrow}
      />
    );
  }

  function renderEmptyCard(eyebrow: string, message: string) {
    return (
      <div className="border-border-soft rounded-2xl border bg-white p-5">
        <span className="text-faint text-[11.5px] font-bold tracking-[.07em] uppercase">
          {eyebrow}
        </span>
        <p className="text-faint mt-2.5 text-sm">{message}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-9">
        <div className="text-brand mb-1.5 text-xs font-bold tracking-[.06em] uppercase">
          {t("home.eyebrow")}
        </div>
        <h1 className="text-[30px] font-extrabold tracking-[-0.02em]">
          {t("home.title")}
        </h1>
      </div>

      {error && <p className="text-brand-dark mb-4 text-sm">{error}</p>}

      {loading && !error && (
        <p className="text-muted text-sm">{t("common.loading")}</p>
      )}

      {!loading && !error && (
        <div className="grid gap-9">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-5">
            <section>
              {latestPublic
                ? renderCard(latestPublic, t("home.latestTitle"))
                : renderEmptyCard(t("home.latestTitle"), t("home.latestEmpty"))}
            </section>

            <section>
              {yourUpload
                ? renderCard(yourUpload, t("home.yourUploadTitle"))
                : renderEmptyCard(t("home.yourUploadTitle"), t("uploadTest.noLessonsYet"))}
            </section>
          </div>

          {subjects.length > 0 && (
            <section>
              <h2 className="mb-3.5 text-[18px] font-bold tracking-[-0.01em]">
                {t("home.browseBySubjectTitle")}
              </h2>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-[18px]">
                {subjects.map((s) => (
                  <SubjectCard
                    key={s.subject}
                    subject={s.subject}
                    lessonCount={s.lessonCount}
                    onOpen={() => navigate(`/subject/${encodeURIComponent(s.subject)}`)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
