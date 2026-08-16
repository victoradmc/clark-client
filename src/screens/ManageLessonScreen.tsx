import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  deleteLesson,
  getLesson,
  getSession,
  updateLesson,
  type Lesson,
  type LessonVisibility,
} from "../data/clarkApi";
import Badge from "../components/Badge";

export default function ManageLessonScreen() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  // A flag, not a pre-translated string — see LessonViewScreen.tsx for why.
  const [notFound, setNotFound] = useState(false);

  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<LessonVisibility>("public");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      let found: Lesson;
      let session: Awaited<ReturnType<typeof getSession>>;
      try {
        [found, session] = await Promise.all([getLesson(id), getSession()]);
      } catch {
        if (!cancelled) {
          setNotFound(true);
        }
        return;
      }
      if (cancelled) return;
      // Set together so the owner check below never runs against a stale
      // currentUserId from a lesson-loaded-before-session-loaded render.
      setLesson(found);
      setTitle(found.title);
      setVisibility(found.visibility);
      setCurrentUserId(session?.user.id ?? null);
    })();

    return () => {
      cancelled = true;
    };
    // Deliberately not depending on `t` — see HubScreen.tsx for why.
  }, [id]);

  async function handleSave() {
    if (!id) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateLesson(id, { title, visibility });
      navigate(`/lessons/${id}`);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : t("manageLesson.couldNotSave"),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteClick() {
    if (!id) return;
    if (!deleteConfirming) {
      setDeleteConfirming(true);
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteLesson(id);
      navigate("/");
    } catch (err) {
      setDeleting(false);
      setDeleteConfirming(false);
      setDeleteError(
        err instanceof Error ? err.message : t("manageLesson.couldNotDelete"),
      );
    }
  }

  if (notFound) {
    return <p className="text-brand-dark text-sm">{t("common.lessonNotVisible")}</p>;
  }

  if (!lesson) {
    return <p className="text-muted text-sm">{t("common.loading")}</p>;
  }

  if (lesson.owner_id !== currentUserId) {
    return <p className="text-brand-dark text-sm">{t("manageLesson.notAllowed")}</p>;
  }

  return (
    <div className="max-w-[460px]">
      <div className="text-brand mb-1.5 text-xs font-bold tracking-[.06em] uppercase">
        {t("manageLesson.eyebrow")}
      </div>
      <h1 className="mb-6 text-[26px] font-extrabold tracking-[-0.02em]">
        {t("manageLesson.title")}
      </h1>
      <div className="grid gap-4">
        <div>
          <label className="text-label mb-1.5 block text-[12.5px] font-semibold">
            {t("manageLesson.titleLabel")}
          </label>
          <input
            className="border-border focus:outline-brand w-full rounded-[11px] border bg-white px-3.5 py-2.5 text-sm focus:outline-2 focus:outline-offset-1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Badge>{lesson.subject}</Badge>
          <Badge>{lesson.origin}</Badge>
        </div>
        <div>
          <label className="text-label mb-2 block text-[12.5px] font-semibold">
            {t("manageLesson.visibilityLabel")}
          </label>
          <div className="grid gap-2">
            <label
              className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-3 ${
                visibility === "public"
                  ? "border-brand bg-brand-tint"
                  : "border-border bg-white"
              }`}
            >
              <input
                type="radio"
                name="visibility"
                checked={visibility === "public"}
                onChange={() => setVisibility("public")}
              />
              <span className="text-[13.5px]">{t("manageLesson.publicOption")}</span>
            </label>
            <label
              className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-3 ${
                visibility === "private"
                  ? "border-brand bg-brand-tint"
                  : "border-border bg-white"
              }`}
            >
              <input
                type="radio"
                name="visibility"
                checked={visibility === "private"}
                onChange={() => setVisibility("private")}
              />
              <span className="text-[13.5px]">{t("manageLesson.privateOption")}</span>
            </label>
          </div>
        </div>
      </div>
      {saveError && (
        <p className="text-brand-dark mt-3 text-[13px]">{saveError}</p>
      )}
      <div className="mt-6 flex gap-2.5">
        <button
          type="button"
          disabled={saving || !title.trim()}
          onClick={() => void handleSave()}
          className="bg-brand rounded-[11px] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {saving ? t("manageLesson.saving") : t("manageLesson.savePublish")}
        </button>
        <Link
          to={`/lessons/${id}`}
          className="text-muted rounded-[11px] bg-transparent px-4 py-2.5 text-sm font-semibold no-underline"
        >
          {t("common.cancel")}
        </Link>
      </div>

      <div className="border-border-soft mt-10 border-t pt-6">
        <div className="mb-1.5 text-[13px] font-bold">{t("manageLesson.deleteTitle")}</div>
        <p className="text-faint mb-3 max-w-[50ch] text-[12.5px]">
          {t("manageLesson.deleteWarning")}
        </p>
        {deleteError && (
          <p className="text-brand-dark mb-2 text-[12.5px]">{deleteError}</p>
        )}
        <button
          type="button"
          disabled={deleting}
          onClick={() => void handleDeleteClick()}
          className="border-brand text-brand rounded-[11px] border-[1.5px] bg-white px-[18px] py-2.5 text-[13.5px] font-bold disabled:opacity-60"
        >
          {deleting
            ? t("manageLesson.deleting")
            : deleteConfirming
              ? t("manageLesson.confirmDelete")
              : t("manageLesson.deleteButton")}
        </button>
      </div>
    </div>
  );
}
