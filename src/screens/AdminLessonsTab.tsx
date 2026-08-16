import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  deleteLesson,
  getAllLessons,
  getOwnerNames,
  type Lesson,
} from "../data/clarkApi";
import { useRowActions } from "../hooks/useRowActions";

export default function AdminLessonsTab() {
  const { t } = useTranslation();
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { errors: rowErrors, run: runRowAction } = useRowActions();

  async function loadLessons() {
    try {
      const data = await getAllLessons();
      setLessons(data);
      setLoadError(null);

      const ownerIds = [...new Set(data.map((l) => l.owner_id))];
      const names = await getOwnerNames(ownerIds);
      setOwnerNames(names);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : t("admin.lessons.couldNotLoad"),
      );
    }
  }

  useEffect(() => {
    void loadLessons();
  }, []);

  const visibleLessons = useMemo(() => {
    if (!lessons) return [];
    const term = search.trim().toLowerCase();
    if (!term) return lessons;
    return lessons.filter(
      (l) =>
        l.title.toLowerCase().includes(term) ||
        l.subject.toLowerCase().includes(term),
    );
  }, [lessons, search]);

  async function handleDelete(lesson: Lesson) {
    await runRowAction(
      lesson.id,
      async () => {
        await deleteLesson(lesson.id);
        await loadLessons();
      },
      t("admin.lessons.couldNotDelete"),
    );
  }

  return (
    <div>
      <input
        className="border-border focus:outline-brand mb-4 w-full rounded-[11px] border bg-white px-3.5 py-2.5 text-sm focus:outline-2 focus:outline-offset-1"
        placeholder={t("admin.lessons.searchPlaceholder")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loadError && <p className="text-brand-dark mb-4 text-sm">{loadError}</p>}

      <div className="border-border-soft overflow-hidden rounded-2xl border bg-white">
        <div className="text-faint grid grid-cols-[1.6fr_1fr_1fr_1fr_100px] gap-2.5 border-b border-[#EEEEEC] px-5 py-3 text-[11.5px] font-bold tracking-[.04em] uppercase">
          <span>{t("admin.lessons.columnTitle")}</span>
          <span>{t("admin.lessons.columnSubject")}</span>
          <span>{t("admin.lessons.columnOwner")}</span>
          <span>{t("admin.lessons.columnVisibility")}</span>
          <span></span>
        </div>
        {visibleLessons.map((lesson) => (
          <div
            key={lesson.id}
            className="grid grid-cols-[1.6fr_1fr_1fr_1fr_100px] items-center gap-2.5 border-b border-[#F3F3F1] px-5 py-3.5 text-[13.5px] last:border-b-0"
          >
            <span className="font-semibold">{lesson.title}</span>
            <span className="text-muted">{lesson.subject}</span>
            <span className="text-muted">
              {ownerNames[lesson.owner_id] ?? "…"}
            </span>
            <span className="text-muted">
              {lesson.visibility === "public" ? t("common.public") : t("common.private")}
            </span>
            <button
              type="button"
              onClick={() => void handleDelete(lesson)}
              className="border-brand text-brand justify-self-end rounded-lg border-[1.5px] bg-white px-2.5 py-1.5 text-xs font-bold"
            >
              {t("admin.lessons.delete")}
            </button>
            {rowErrors[lesson.id] && (
              <p className="text-brand-dark col-span-full text-[12px]">
                {rowErrors[lesson.id]}
              </p>
            )}
          </div>
        ))}
      </div>
      {visibleLessons.length === 0 && (
        <p className="text-faint mt-6 text-sm">{t("admin.lessons.noneLeft")}</p>
      )}
    </div>
  );
}
