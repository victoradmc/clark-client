import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toggleLessonStar } from "../data/clarkApi";
import { friendlyErrorMessage } from "../data/errorMessage";

// Shared by the Hub's Lesson cards, the Lesson detail page, and (ticket 03)
// My Library — owns its own starred/count state seeded from the initial
// props so a click doesn't have to wait on the parent list to re-fetch.
export default function StarButton({
  lessonId,
  starred: initialStarred,
  starCount: initialStarCount,
}: {
  lessonId: string;
  starred: boolean;
  starCount: number;
}) {
  const { t } = useTranslation();
  const [starred, setStarred] = useState(initialStarred);
  const [starCount, setStarCount] = useState(initialStarCount);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await toggleLessonStar(lessonId);
      setStarred(result.starred);
      setStarCount(result.star_count);
    } catch (err) {
      setError(friendlyErrorMessage(err, t("common.couldNotStar")));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-0.5">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleClick}
          disabled={pending}
          aria-pressed={starred}
          aria-label={starred ? t("common.unstar") : t("common.star")}
          className={`text-[17px] leading-none disabled:opacity-50 ${
            starred ? "text-brand" : "text-faint"
          }`}
        >
          {starred ? "★" : "☆"}
        </button>
        <span className="text-faint text-[12px] font-semibold">{starCount}</span>
      </div>
      {error && <span className="text-brand-dark text-[10.5px]">{error}</span>}
    </div>
  );
}
