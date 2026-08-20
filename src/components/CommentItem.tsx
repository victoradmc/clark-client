import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  createReply,
  deleteComment,
  updateComment,
  type CommentWithReplies,
  type LessonComment,
  type LessonReply,
} from "../data/clarkApi";
import { COMMENT_BODY_MAX_LENGTH } from "../data/commentValidation";
import { friendlyErrorMessage } from "../data/errorMessage";
import { useEditAndDelete } from "../hooks/useEditAndDelete";
import ReplyItem from "./ReplyItem";

// One row in CommentSection's list — the Comment's own edit/delete-confirm
// state is the same shared machine ReplyItem uses (useEditAndDelete); edit
// and delete both resolve to the same onChanged callback since both
// produce one updated LessonComment row from the server (an edited body,
// or a deleted_at stamp), never a client-guessed value.
//
// Also owns its Replies as a self-contained sub-thread (ticket 05):
// fetched once as part of the Comment (comment.replies) and never routed
// back through CommentSection afterward — same "seeded from initial
// props, then locally managed" shape StarButton already uses.
export default function CommentItem({
  comment,
  resolveAuthorLabel,
  canEdit,
  canDelete,
  onChanged,
}: {
  comment: CommentWithReplies;
  resolveAuthorLabel: (authorId: string) => string;
  canEdit: (authorId: string) => boolean;
  canDelete: (authorId: string) => boolean;
  onChanged: (updated: LessonComment) => void;
}) {
  const { t } = useTranslation();
  const {
    editing,
    editDraft,
    setEditDraft,
    saving,
    saveError,
    startEdit,
    cancelEdit,
    handleSave,
    deleteConfirming,
    deleting,
    deleteError,
    handleDeleteClick,
  } = useEditAndDelete<LessonComment, LessonComment>({
    initialBody: comment.body,
    onSave: (body) => updateComment(comment.id, body),
    onSaved: onChanged,
    onDelete: () => deleteComment(comment.id),
    onDeleted: onChanged,
    saveErrorFallback: t("comments.couldNotSave"),
    deleteErrorFallback: t("comments.couldNotDelete"),
  });

  const [replies, setReplies] = useState<LessonReply[]>(comment.replies);
  const [replying, setReplying] = useState(false);
  const [replyDraft, setReplyDraft] = useState("");
  const [postingReply, setPostingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const isDeleted = comment.deleted_at !== null;

  async function handlePostReply() {
    if (postingReply || !replyDraft.trim()) return;
    setPostingReply(true);
    setReplyError(null);
    try {
      const created = await createReply(comment.id, replyDraft);
      setReplies((prev) => [...prev, created]);
      setReplyDraft("");
      setReplying(false);
    } catch (err) {
      setReplyError(friendlyErrorMessage(err, t("comments.couldNotPostReply")));
    } finally {
      setPostingReply(false);
    }
  }

  function handleReplyUpdated(updated: LessonReply) {
    setReplies((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  function handleReplyDeleted(replyId: string) {
    setReplies((prev) => prev.filter((r) => r.id !== replyId));
  }

  return (
    <li className="border-border-soft rounded-[14px] border bg-white p-4">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-[13px] font-bold">{resolveAuthorLabel(comment.author_id)}</span>
        <span className="text-faint text-[11.5px]">
          {new Date(comment.created_at).toLocaleDateString()}
        </span>
      </div>

      {isDeleted ? (
        <p className="text-faint text-sm italic">{t("comments.deleted")}</p>
      ) : editing ? (
        <div>
          <textarea
            className="border-border focus:outline-brand min-h-[70px] w-full rounded-[11px] border bg-white px-3.5 py-2.5 text-sm leading-relaxed focus:outline-2 focus:outline-offset-1"
            value={editDraft}
            maxLength={COMMENT_BODY_MAX_LENGTH}
            onChange={(e) => setEditDraft(e.target.value)}
          />
          {saveError && <p className="text-brand-dark mt-2 text-[12.5px]">{saveError}</p>}
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              disabled={saving || !editDraft.trim()}
              onClick={() => void handleSave()}
              className="bg-brand rounded-[11px] px-4 py-2 text-[13px] font-bold text-white disabled:opacity-60"
            >
              {saving ? t("comments.saving") : t("comments.save")}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={cancelEdit}
              className="border-border rounded-[11px] border bg-white px-4 py-2 text-[13px] font-bold disabled:opacity-60"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{comment.body}</p>
      )}

      {!isDeleted && !editing && (canEdit(comment.author_id) || canDelete(comment.author_id)) && (
        <div className="mt-2.5 flex gap-3">
          {canEdit(comment.author_id) && (
            <button
              type="button"
              onClick={startEdit}
              className="text-brand text-[12.5px] font-bold"
            >
              {t("comments.edit")}
            </button>
          )}
          {canDelete(comment.author_id) && (
            <button
              type="button"
              disabled={deleting}
              onClick={() => void handleDeleteClick()}
              className="text-brand-dark text-[12.5px] font-bold disabled:opacity-60"
            >
              {deleting
                ? t("comments.deleting")
                : deleteConfirming
                  ? t("comments.confirmDelete")
                  : t("comments.delete")}
            </button>
          )}
        </div>
      )}
      {deleteError && <p className="text-brand-dark mt-1.5 text-[12.5px]">{deleteError}</p>}

      {/* Replies stay visible under a soft-deleted Comment too — spec: "so
          that Replies underneath ... aren't silently orphaned or erased." */}
      {replies.length > 0 && (
        <ul className="border-border-soft mt-3 ml-4 flex flex-col gap-3 border-l-2 pl-4">
          {replies.map((reply) => (
            <ReplyItem
              key={reply.id}
              reply={reply}
              authorLabel={resolveAuthorLabel(reply.author_id)}
              canEdit={canEdit(reply.author_id)}
              canDelete={canDelete(reply.author_id)}
              onUpdated={handleReplyUpdated}
              onDeleted={handleReplyDeleted}
            />
          ))}
        </ul>
      )}

      {/* Unlike the Replies list above, the compose-a-new-Reply affordance
          hides once the parent Comment is deleted — nothing in the spec
          calls for keeping a "[deleted]" thread open to new activity, only
          for preserving what's already there. */}
      {!isDeleted && (
        <div className="mt-2.5">
          {replying ? (
            <div>
              <textarea
                className="border-border focus:outline-brand min-h-[60px] w-full rounded-[11px] border bg-white px-3.5 py-2.5 text-[13px] leading-relaxed focus:outline-2 focus:outline-offset-1"
                placeholder={t("comments.replyPlaceholder")}
                value={replyDraft}
                maxLength={COMMENT_BODY_MAX_LENGTH}
                onChange={(e) => setReplyDraft(e.target.value)}
              />
              {replyError && <p className="text-brand-dark mt-2 text-[12px]">{replyError}</p>}
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={postingReply || !replyDraft.trim()}
                  onClick={() => void handlePostReply()}
                  className="bg-brand rounded-[11px] px-3.5 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-60"
                >
                  {postingReply ? t("comments.posting") : t("comments.postReply")}
                </button>
                <button
                  type="button"
                  disabled={postingReply}
                  onClick={() => {
                    setReplying(false);
                    setReplyDraft("");
                    setReplyError(null);
                  }}
                  className="border-border rounded-[11px] border bg-white px-3.5 py-1.5 text-[12.5px] font-bold disabled:opacity-60"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setReplying(true)}
              className="text-brand text-[12.5px] font-bold"
            >
              {t("comments.reply")}
            </button>
          )}
        </div>
      )}
    </li>
  );
}
