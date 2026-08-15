import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getLesson, type Lesson } from "../data/clarkApi";

export default function TakeTestScreen() {
  const { id } = useParams<{ id: string }>();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [error, setError] = useState<string | null>(null);

  // qIndex -> selected option index. Nothing here is ever persisted, so a
  // fresh mount (re-navigating from the Lesson view) always starts empty.
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const found = await getLesson(id);
        if (!cancelled) setLesson(found);
      } catch {
        if (!cancelled) {
          setError("This lesson doesn't exist or isn't visible to you.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  function selectAnswer(qIndex: number, optIndex: number) {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qIndex]: optIndex }));
  }

  if (error) {
    return <p className="text-brand-dark text-sm">{error}</p>;
  }

  if (!lesson) {
    return <p className="text-muted text-sm">Loading…</p>;
  }

  const questions = lesson.test ?? [];
  const correctCount = submitted
    ? questions.filter((q, qi) => q.options[answers[qi]] === q.answer).length
    : 0;

  return (
    <div className="max-w-[620px]">
      <Link
        to={`/lessons/${id}`}
        className="text-muted mb-5 inline-block text-[13.5px] font-semibold no-underline"
      >
        ← Back to lesson
      </Link>
      <div className="text-brand mb-1.5 text-xs font-bold tracking-[.06em] uppercase">
        Test
      </div>
      <h1 className="mb-7 text-[26px] font-extrabold tracking-[-0.02em]">
        {lesson.title}
      </h1>

      {submitted && (
        <div className="bg-ink mb-7 rounded-2xl p-6 text-white">
          <div className="mb-1.5 text-[11.5px] font-bold tracking-[.06em] text-[#F0A78C] uppercase">
            Score
          </div>
          <div className="text-[32px] font-extrabold">
            {correctCount} / {questions.length} correct
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
              const isSelected = answers[qi] === oi;
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
                      onChange={() => selectAnswer(qi, oi)}
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
                      {isCorrectOpt ? "Correct answer" : "Your answer"}
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
          Submit answers
        </button>
      )}
      {submitted && (
        <Link
          to={`/lessons/${id}`}
          className="border-border inline-block rounded-[11px] border bg-white px-[22px] py-3 text-[14.5px] font-semibold no-underline"
        >
          Done
        </Link>
      )}
    </div>
  );
}
