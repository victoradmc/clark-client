import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getLessons,
  getOwnerNames,
  getSession,
  type HubTab,
  type Lesson,
} from "../data/clarkApi";
import Badge from "../components/Badge";

const ALL_SUBJECTS = "All subjects";

export default function HubScreen() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<HubTab>("public");
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState(ALL_SUBJECTS);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSession().then((session) => setCurrentUserId(session?.user.id ?? null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const data = await getLessons({ tab, search });
        if (cancelled) return;
        setLessons(data);
        setError(null);

        const ownerIds = [...new Set(data.map((l) => l.owner_id))];
        const names = await getOwnerNames(ownerIds);
        if (!cancelled) setOwnerNames(names);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not load lessons.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, search]);

  function handleTabChange(next: HubTab) {
    setTab(next);
    setSubject(ALL_SUBJECTS);
  }

  // Search narrows the same tab+search-derived list the subject dropdown's
  // options come from, so a previously-selected Subject can stop existing
  // in that list — reset it rather than leave a stale selection filtering
  // to a now-empty result.
  function handleSearchChange(next: string) {
    setSearch(next);
    setSubject(ALL_SUBJECTS);
  }

  const subjectOptions = useMemo(
    () => [...new Set(lessons.map((l) => l.subject))].sort(),
    [lessons],
  );

  const visibleLessons = useMemo(
    () =>
      subject === ALL_SUBJECTS
        ? lessons
        : lessons.filter((l) => l.subject === subject),
    [lessons, subject],
  );

  function ownerLabel(lesson: Lesson): string {
    if (lesson.owner_id === currentUserId) return "You";
    return ownerNames[lesson.owner_id] ?? "…";
  }

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-brand mb-1.5 text-xs font-bold tracking-[.06em] uppercase">
            Lesson Hub
          </div>
          <h1 className="text-[30px] font-extrabold tracking-[-0.02em]">
            Find something to learn
          </h1>
        </div>
        <div className="bg-chip flex gap-0.5 rounded-[11px] p-1">
          <button
            type="button"
            onClick={() => handleTabChange("public")}
            className={`rounded-lg px-4 py-2 text-[13px] font-semibold ${
              tab === "public" ? "bg-white text-ink" : "text-muted"
            }`}
          >
            Public
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("mine")}
            className={`rounded-lg px-4 py-2 text-[13px] font-semibold ${
              tab === "mine" ? "bg-white text-ink" : "text-muted"
            }`}
          >
            My lessons
          </button>
        </div>
      </div>

      <div className="mb-7 flex flex-wrap gap-3">
        <input
          className="border-border focus:outline-brand min-w-[220px] flex-1 rounded-[11px] border bg-white px-3.5 py-2.5 text-sm focus:outline-2 focus:outline-offset-1"
          placeholder="Search by title…"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
        <select
          className="border-border min-w-[170px] rounded-[11px] border bg-white px-3.5 py-2.5 text-sm"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        >
          <option value={ALL_SUBJECTS}>{ALL_SUBJECTS}</option>
          {subjectOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-brand-dark mb-4 text-sm">{error}</p>}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-[18px]">
        {visibleLessons.map((lesson) => (
          <div
            key={lesson.id}
            className="border-border-soft flex flex-col gap-2.5 rounded-2xl border bg-white p-5 shadow-[0_1px_2px_rgba(16,24,32,.03)]"
          >
            <div className="flex items-center justify-between">
              <Badge tone="brand">{lesson.subject}</Badge>
              <span className="text-faint text-[11.5px] font-semibold">
                {lesson.visibility === "public" ? "Public" : "Private"}
              </span>
            </div>
            <div className="text-[16.5px] leading-tight font-bold tracking-[-0.01em]">
              {lesson.title}
            </div>
            <p className="text-muted flex-1 text-[12.5px]">
              Source: {lesson.origin}
            </p>
            <div className="text-faint text-[12px]">By {ownerLabel(lesson)}</div>
            <div className="mt-1.5 flex gap-2">
              <button
                type="button"
                onClick={() => navigate(`/lessons/${lesson.id}`)}
                className="bg-ink flex-1 rounded-[10px] px-3.5 py-2.5 text-[13px] font-semibold text-white"
              >
                Open
              </button>
              {lesson.owner_id === currentUserId && (
                <button
                  type="button"
                  onClick={() => navigate(`/lessons/${lesson.id}/manage`)}
                  className="border-border text-label rounded-[10px] border bg-white px-3 py-2.5 text-[13px] font-semibold"
                >
                  Manage
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {!loading && !error && visibleLessons.length === 0 && (
        <p className="text-faint mt-8 text-sm">
          No lessons match. Try a different search or subject.
        </p>
      )}
    </div>
  );
}
