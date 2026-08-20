import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  createComment,
  getLessonComments,
  getOwnerNames,
  getProfile,
  getSession,
  type CommentWithReplies,
  type LessonComment,
} from "../data/clarkApi";
import { COMMENT_BODY_MAX_LENGTH } from "../data/commentValidation";
import { friendlyErrorMessage } from "../data/errorMessage";
import CommentItem from "./CommentItem";

// Lesson detail page only (spec: not on cards in list views). Owns its own
// fetch/create state for the top-level Comments — LessonViewScreen just
// mounts it with a lessonId, same "self-contained section" shape as
// StarButton. Per-Comment edit/delete and per-Reply state both live inside
// CommentItem.
export default function CommentSection({ lessonId }: { lessonId: string }) {
  const { t } = useTranslation();
  const [comments, setComments] = useState<CommentWithReplies[]>([]);
  const [authorNames, setAuthorNames] = useState<Record<string, string>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  useEffect(() => {
    getSession().then((session) => setCurrentUserId(session?.user.id ?? null));
    getProfile()
      .then((profile) => setIsAdmin(profile.role === "admin"))
      .catch(() => setIsAdmin(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const data = await getLessonComments(lessonId);
        if (cancelled) return;
        setComments(data);
        setLoadError(null);

        const authorIds = new Set<string>();
        for (const comment of data) {
          authorIds.add(comment.author_id);
          for (const reply of comment.replies) authorIds.add(reply.author_id);
        }
        const names = await getOwnerNames([...authorIds]);
        if (!cancelled) setAuthorNames(names);
      } catch (err) {
        if (!cancelled) setLoadError(friendlyErrorMessage(err, t("comments.couldNotLoad")));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Deliberately not depending on `t` — see HubScreen.tsx for why.
  }, [lessonId]);

  // Shared by both Comments and Replies — same author/Admin permission
  // rule applies to each (ticket 05: "Same author/Admin edit-delete rules
  // as Comments"). Passed down as functions rather than precomputed
  // booleans since CommentItem needs to evaluate them per-Reply too, not
  // just once for its own Comment.
  function resolveAuthorLabel(authorId: string): string {
    if (authorId === currentUserId) return t("common.you");
    return authorNames[authorId] ?? "…";
  }
  function canEdit(authorId: string): boolean {
    return authorId === currentUserId;
  }
  function canDelete(authorId: string): boolean {
    return authorId === currentUserId || isAdmin;
  }

  // createComment/updateComment/deleteComment all return a bare
  // LessonComment with no `replies` key — spreading the existing entry
  // first preserves its already-fetched replies rather than dropping them.
  function handleCommentChanged(updated: LessonComment) {
    setComments((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
  }

  async function handlePost() {
    if (posting || !draft.trim()) return;
    setPosting(true);
    setPostError(null);
    try {
      const created = await createComment(lessonId, draft);
      setComments((prev) => [{ ...created, replies: [] }, ...prev]);
      setDraft("");
    } catch (err) {
      setPostError(friendlyErrorMessage(err, t("comments.couldNotPost")));
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="border-border-soft mt-10 border-t pt-8">
      <h2 className="mb-4 text-[19px] font-extrabold tracking-[-0.01em]">
        {t("comments.title")}
      </h2>

      <div className="mb-6">
        <label htmlFor="comment-composer" className="sr-only">
          {t("comments.composerLabel")}
        </label>
        <textarea
          id="comment-composer"
          className="border-border focus:outline-brand min-h-[80px] w-full rounded-[11px] border bg-white px-3.5 py-2.5 text-sm leading-relaxed focus:outline-2 focus:outline-offset-1"
          placeholder={t("comments.composerPlaceholder")}
          value={draft}
          maxLength={COMMENT_BODY_MAX_LENGTH}
          onChange={(e) => setDraft(e.target.value)}
        />
        {postError && <p className="text-brand-dark mt-2 text-[12.5px]">{postError}</p>}
        <button
          type="button"
          disabled={posting || !draft.trim()}
          onClick={() => void handlePost()}
          className="bg-brand mt-2.5 rounded-[11px] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {posting ? t("comments.posting") : t("comments.post")}
        </button>
      </div>

      {loadError && <p className="text-brand-dark text-sm">{loadError}</p>}

      {loading && !loadError && <p className="text-muted text-sm">{t("common.loading")}</p>}

      {!loading && !loadError && comments.length === 0 && (
        <p className="text-faint text-sm">{t("comments.empty")}</p>
      )}

      {!loading && comments.length > 0 && (
        <ul className="flex flex-col gap-5">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              resolveAuthorLabel={resolveAuthorLabel}
              canEdit={canEdit}
              canDelete={canDelete}
              onChanged={handleCommentChanged}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
