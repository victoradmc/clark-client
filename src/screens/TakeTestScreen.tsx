import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getLesson, type Lesson } from "../data/clarkApi";
import { shuffleArray } from "../data/shuffleArray";

export default function TakeTestScreen() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  // A flag, not a pre-translated string — see LessonViewScreen.tsx for why.
  const [notFound, setNotFound] = useState(false);

  // qIndex -> selected option text (not index — each Question's options are
  // shuffled below, so an index would mean different things depending on
  // which array it's read against). Nothing here is ever persisted, so a
  // fresh mount (re-navigating from the Lesson view) always starts empty.
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);

  // Randomized once per mount (keyed on `lesson`, which only changes when a
  // new fetch resolves) so the option order stays stable across re-renders
  // within one attempt but can differ on a fresh attempt — never mutates
  // `lesson.test` itself.
  const questions = useMemo(
    () =>
      (lesson?.test ?? []).map((q) => ({
        ...q,
        options: shuffleArray(q.options),
      })),
    [lesson],
  );

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const found = await getLesson(id);
        if (!cancelled) setLesson(found);
      } catch {
        if (!cancelled) {
          setNotFound(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Deliberately not depending on `t` — see HubScreen.tsx for why.
  }, [id]);

  function selectAnswer(qIndex: number, option: string) {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qIndex]: option }));
  }

  if (notFound) {
    return <p className="text-brand-dark text-sm">{t("common.lessonNotVisible")}</p>;
  }

  if (!lesson) {
    return <p className="text-muted text-sm">{t("common.loading")}</p>;
  }

  const correctCount = submitted
    ? questions.filter((q, qi) => answers[qi] === q.answer).length
    : 0;

  return (
    <div className="max-w-[620px]">
      <Link
        to={`/lessons/${id}`}
        className="text-muted mb-5 inline-block text-[13.5px] font-semibold no-underline"
      >
        {t("takeTest.backToLesson")}
      </Link>
      <div className="text-brand mb-1.5 text-xs font-bold tracking-[.06em] uppercase">
        {t("takeTest.eyebrow")}
      </div>
      <h1 className="mb-7 text-[26px] font-extrabold tracking-[-0.02em]">
        {lesson.title}
      </h1>

      {submitted && (
        <div className="bg-ink mb-7 rounded-2xl p-6 text-white">
          <div className="mb-1.5 text-[11.5px] font-bold tracking-[.06em] text-[#F0A78C] uppercase">
            {t("takeTest.score")}
          </div>
          <div className="text-[32px] font-extrabold">
            {t("takeTest.scoreValue", {
              correct: correctCount,
              total: questions.length,
            })}
          </div>
        </div>
      )}

      {questions.map((question, qi) => (
        <div key={qi} className="mb-6">
          <p className="mb-2.5 text-[15px] font-bold">
            {qi + 1}. {question.question}
          </p>
          <div className="grid gap-2">
            {question.options.map((option, oi) => {
              const isSelected = answers[qi] === option;
              const isCorrectOpt = option === question.answer;

              let borderClass = "border-border";
              let bgClass = "bg-white";
              if (submitted && isCorrectOpt) {
                borderClass = "border-[#1D7A3E]";
                bgClass = "bg-[#EDF9F1]";
              } else if (submitted && isSelected && !isCorrectOpt) {
                borderClass = "border-brand";
                bgClass = "bg-brand-tint";
              } else if (!submitted && isSelected) {
                borderClass = "border-ink";
                bgClass = "bg-page";
              }

              const showResultTag = submitted && (isSelected || isCorrectOpt);

              return (
                <label
                  key={oi}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border-[1.5px] px-3.5 py-3 ${borderClass} ${bgClass}`}
                >
                  <span className="flex items-center gap-2.5 text-sm">
                    <input
                      type="radio"
                      name={`question-${qi}`}
                      checked={isSelected}
                      disabled={submitted}
                      onChange={() => selectAnswer(qi, option)}
                    />
                    {option}
                  </span>
                  {showResultTag && (
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        isCorrectOpt
                          ? "bg-[#DBF3E3] text-[#1D7A3E]"
                          : "bg-brand-tint text-brand-dark"
                      }`}
                    >
                      {isCorrectOpt ? t("takeTest.correctAnswer") : t("takeTest.yourAnswer")}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      ))}

      {!submitted && (
        <button
          type="button"
          onClick={() => setSubmitted(true)}
          className="bg-brand rounded-[11px] px-[22px] py-3 text-[14.5px] font-bold text-white"
        >
          {t("takeTest.submit")}
        </button>
      )}
      {submitted && (
        <Link
          to={`/lessons/${id}`}
          className="border-border inline-block rounded-[11px] border bg-white px-[22px] py-3 text-[14.5px] font-semibold no-underline"
        >
          {t("takeTest.done")}
        </Link>
      )}
    </div>
  );
}
