import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Markdown from "react-markdown";
import { useTranslation } from "react-i18next";
import { getLesson, getOwnerNames, type Lesson } from "../data/clarkApi";
import Badge from "../components/Badge";

export default function LessonViewScreen() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  // A flag, not a pre-translated string — the message is translated at
  // render time via `t()` below, so it can't get frozen in whatever
  // language was active the moment this effect's catch block ran (a real
  // race on a fresh page load, before App.tsx's Account-locale switch has
  // necessarily resolved).
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      let found: Lesson;
      try {
        found = await getLesson(id);
      } catch {
        if (!cancelled) {
          setNotFound(true);
        }
        return;
      }
      if (cancelled) return;
      setLesson(found);

      try {
        const names = await getOwnerNames([found.owner_id]);
        if (!cancelled) setOwnerName(names[found.owner_id] ?? "Unknown");
      } catch {
        if (!cancelled) setOwnerName("Unknown");
      }
    })();

    return () => {
      cancelled = true;
    };
    // Deliberately not depending on `t` — see HubScreen.tsx for why.
  }, [id]);

  if (notFound) {
    return <p className="text-brand-dark text-sm">{t("common.lessonNotVisible")}</p>;
  }

  if (!lesson) {
    return <p className="text-muted text-sm">{t("common.loading")}</p>;
  }

  return (
    <div className="max-w-[700px]">
      <Link
        to="/"
        className="text-muted mb-5 inline-block text-[13.5px] font-semibold no-underline"
      >
        {t("lessonView.backToHub")}
      </Link>
      <div className="mb-2.5 flex gap-2">
        <Badge tone="brand">{lesson.subject}</Badge>
        <Badge>
          {lesson.visibility === "public" ? t("common.public") : t("common.private")}
        </Badge>
      </div>
      <h1 className="mb-1.5 text-[30px] font-extrabold tracking-[-0.02em]">
        {lesson.title}
      </h1>
      <p className="text-faint mb-8 text-[12.5px]">
        {t("common.source", { origin: lesson.origin })} ·{" "}
        {t("common.byOwner", { name: ownerName ?? "…" })}
      </p>

      <div className="prose prose-sm max-w-none">
        <Markdown>{lesson.content}</Markdown>
      </div>

      <div className="bg-ink mt-10 max-w-[400px] rounded-[18px] p-7 text-white">
        <div className="mb-2 text-[11.5px] font-bold tracking-[.06em] text-[#F0A78C] uppercase">
          {t("lessonView.checkKnowledge")}
        </div>
        <div className="text-base leading-snug font-semibold">
          {lesson.test && lesson.test.length > 0
            ? t("lessonView.questionsAvailable", { count: lesson.test.length })
            : t("lessonView.noTest")}
        </div>
        {lesson.test && lesson.test.length > 0 && (
          <Link
            to={`/lessons/${lesson.id}/test`}
            className="bg-brand mt-4 inline-block rounded-[11px] px-5 py-2.5 text-sm font-bold text-white no-underline"
          >
            {t("lessonView.takeTest")}
          </Link>
        )}
      </div>
    </div>
  );
}
