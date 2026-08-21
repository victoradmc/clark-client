import { useTranslation } from "react-i18next";

// Home's "Browse by subject" grid (ticket 02) — one of these per normalized
// Subject group. Deliberately not LessonCard: it links to a Subject (a
// name + a count), not to a single Lesson.
export default function SubjectCard({
  subject,
  lessonCount,
  onOpen,
}: {
  subject: string;
  lessonCount: number;
  onOpen: () => void;
}) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={onOpen}
      className="border-border-soft flex items-center justify-between gap-3 rounded-2xl border bg-white p-5 text-left shadow-[0_1px_2px_rgba(16,24,32,.03)]"
    >
      <span className="text-[16.5px] font-bold tracking-[-0.01em]">{subject}</span>
      <span className="text-faint text-[12.5px] font-semibold whitespace-nowrap">
        {t("home.subjectLessonCount", { count: lessonCount })}
      </span>
    </button>
  );
}
