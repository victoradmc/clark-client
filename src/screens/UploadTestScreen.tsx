import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { getLessons, publishTest, type Lesson, type Question } from "../data/clarkApi";
import { parseTestJson } from "../data/testValidation";

export default function UploadTestScreen() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [myLessons, setMyLessons] = useState<Lesson[] | null>(null);
  const [lessonId, setLessonId] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  const [text, setText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<Question[] | null>(null);

  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const lessons = await getLessons({ tab: "mine" });
        if (cancelled) return;
        setMyLessons(lessons);
        setLessonId(lessons[0]?.id ?? "");
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Could not load your lessons.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ""));
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleParse() {
    try {
      setParsed(parseTestJson(text));
      setParseError(null);
    } catch (err) {
      setParsed(null);
      setParseError(
        err instanceof Error ? err.message : "Could not parse the upload.",
      );
    }
  }

  async function handlePublish() {
    if (!parsed || !lessonId) return;
    setPublishing(true);
    setPublishError(null);
    try {
      await publishTest(lessonId, parsed);
      navigate(`/lessons/${lessonId}`);
    } catch (err) {
      setPublishError(
        err instanceof Error ? err.message : "Could not publish this test.",
      );
    } finally {
      setPublishing(false);
    }
  }

  if (loadError) {
    return <p className="text-brand-dark text-sm">{loadError}</p>;
  }

  if (!myLessons) {
    return <p className="text-muted text-sm">Loading…</p>;
  }

  if (myLessons.length === 0) {
    return (
      <p className="text-muted text-sm">
        Upload a lesson first — a Test attaches to one of your own Lessons.
      </p>
    );
  }

  return (
    <div>
      <div className="text-brand mb-1.5 text-xs font-bold tracking-[.06em] uppercase">
        Upload
      </div>
      <h1 className="mb-2 text-[28px] font-extrabold tracking-[-0.02em]">
        Upload a test JSON
      </h1>
      <p className="text-muted mb-5 max-w-[60ch] text-[13.5px]">
        Attach a set of questions to one of your lessons. Expected shape: an
        array of {"{ question, options, answer }"}.
      </p>

      <div className="mb-4 max-w-[320px]">
        <label className="text-label mb-1.5 block text-[12.5px] font-semibold">
          Attach to lesson
        </label>
        <select
          className="border-border w-full rounded-[11px] border bg-white px-3.5 py-2.5 text-sm"
          value={lessonId}
          onChange={(e) => setLessonId(e.target.value)}
        >
          {myLessons.map((lesson) => (
            <option key={lesson.id} value={lesson.id}>
              {lesson.title}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFileChange}
          className="text-sm"
        />
      </div>

      <textarea
        className="border-border focus:outline-brand min-h-[260px] w-full rounded-2xl border bg-white p-4 font-mono text-[12.5px] leading-relaxed focus:outline-2 focus:outline-offset-1"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='[{"question": "...", "options": ["...", "..."], "answer": "..."}]'
      />
      {parseError && (
        <p className="text-brand-dark mt-2.5 text-[12.5px]">{parseError}</p>
      )}

      <div className="mt-[18px]">
        <button
          type="button"
          onClick={handleParse}
          className="bg-brand rounded-[11px] px-5 py-2.5 text-sm font-bold text-white"
        >
          Parse &amp; preview
        </button>
      </div>

      {parsed && (
        <div className="mt-6 grid max-w-[600px] gap-2.5">
          <div className="text-faint text-[11.5px] font-bold tracking-[.06em] uppercase">
            Preview — {parsed.length} question{parsed.length === 1 ? "" : "s"}
          </div>
          {parsed.map((question, i) => (
            <div
              key={i}
              className="border-border-soft rounded-xl border bg-white px-4 py-3.5"
            >
              <div className="text-[13.5px] font-semibold">
                {question.question}
              </div>
              <div className="text-faint mt-1 text-xs">
                Answer: {question.answer}
              </div>
            </div>
          ))}
          {publishError && (
            <p className="text-brand-dark text-[12.5px]">{publishError}</p>
          )}
          <button
            type="button"
            disabled={publishing}
            onClick={() => void handlePublish()}
            className="border-border justify-self-start rounded-[10px] border bg-white px-[18px] py-2.5 text-[13.5px] font-semibold disabled:opacity-60"
          >
            {publishing ? "Attaching…" : "Attach test to lesson"}
          </button>
        </div>
      )}
    </div>
  );
}
