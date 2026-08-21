import { useTranslation } from "react-i18next";
import type { Lesson } from "../data/clarkApi";
import Badge from "./Badge";
import StarButton from "./StarButton";

// Shared by the Hub and My Library (ticket 03) — the one place a Lesson's
// card markup lives, so both screens stay visually and behaviorally
// identical (star toggle included) without copy-pasting the card.
export default function LessonCard({
  lesson,
  ownerLabel,
  starred,
  isOwner,
  onOpen,
  onManage,
  eyebrow,
}: {
  lesson: Lesson;
  ownerLabel: string;
  starred: boolean;
  isOwner: boolean;
  onOpen: () => void;
  onManage: () => void;
  eyebrow?: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="border-border-soft flex h-full flex-col gap-2.5 rounded-2xl border bg-white p-5 shadow-[0_1px_2px_rgba(16,24,32,.03)]">
      {eyebrow && (
        <span className="text-faint text-[11.5px] font-bold tracking-[.07em] uppercase">
          {eyebrow}
        </span>
      )}
      <div className="flex items-center justify-between">
        <Badge tone="brand">{lesson.subject}</Badge>
        <div className="flex items-center gap-2.5">
          <span className="text-faint text-[11.5px] font-semibold">
            {lesson.visibility === "public" ? t("common.public") : t("common.private")}
          </span>
          <StarButton
            lessonId={lesson.id}
            starred={starred}
            starCount={lesson.star_count}
          />
        </div>
      </div>
      <div className="line-clamp-2 text-[16.5px] leading-tight font-bold tracking-[-0.01em]">
        {lesson.title}
      </div>
      <p className="text-muted line-clamp-2 flex-1 text-[12.5px] break-words">
        {t("common.source", { origin: lesson.origin })}
      </p>
      <div className="text-faint truncate text-[12px]">
        {t("common.byOwner", { name: ownerLabel })}
      </div>
      <div className="mt-1.5 flex gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="bg-ink flex-1 rounded-[10px] px-3.5 py-2.5 text-[13px] font-semibold text-white"
        >
          {t("hub.open")}
        </button>
        {isOwner && (
          <button
            type="button"
            onClick={onManage}
            className="border-border text-label rounded-[10px] border bg-white px-3 py-2.5 text-[13px] font-semibold"
          >
            {t("hub.manage")}
          </button>
        )}
      </div>
    </div>
  );
}
