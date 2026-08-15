import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Markdown from "react-markdown";
import { getLesson, getOwnerNames, type Lesson } from "../data/clarkApi";
import Badge from "../components/Badge";

export default function LessonViewScreen() {
  const { id } = useParams<{ id: string }>();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      let found: Lesson;
      try {
        found = await getLesson(id);
      } catch {
        if (!cancelled) {
          setError("This lesson doesn't exist or isn't visible to you.");
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
  }, [id]);

  if (error) {
    return <p className="text-brand-dark text-sm">{error}</p>;
  }

  if (!lesson) {
    return <p className="text-muted text-sm">Loading…</p>;
  }

  return (
    <div className="max-w-[700px]">
      <Link
        to="/"
        className="text-muted mb-5 inline-block text-[13.5px] font-semibold no-underline"
      >
        ← Back to hub
      </Link>
      <div className="mb-2.5 flex gap-2">
        <Badge tone="brand">{lesson.subject}</Badge>
        <Badge>{lesson.visibility === "public" ? "Public" : "Private"}</Badge>
      </div>
      <h1 className="mb-1.5 text-[30px] font-extrabold tracking-[-0.02em]">
        {lesson.title}
      </h1>
      <p className="text-faint mb-8 text-[12.5px]">
        Source: {lesson.origin} · By {ownerName ?? "…"}
      </p>

      <div className="prose prose-sm max-w-none">
        <Markdown>{lesson.content}</Markdown>
      </div>

      <div className="bg-ink mt-10 max-w-[400px] rounded-[18px] p-7 text-white">
        <div className="mb-2 text-[11.5px] font-bold tracking-[.06em] text-[#F0A78C] uppercase">
          Check your knowledge
        </div>
        {/* Ticket 05 adds the Test-taking flow when lesson.test is set;
            nothing in ticket 02 can create a Lesson with a Test yet. */}
        <div className="text-base leading-snug font-semibold">
          No test has been uploaded for this lesson yet.
        </div>
      </div>
    </div>
  );
}
