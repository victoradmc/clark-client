import { useTranslation } from "react-i18next";
import { deleteReply, updateReply, type LessonReply } from "../data/clarkApi";
import { COMMENT_BODY_MAX_LENGTH } from "../data/commentValidation";
import { useEditAndDelete } from "../hooks/useEditAndDelete";

// One Reply beneath a CommentItem. No tombstone state (ADR 0008 — a Reply
// has no children to protect) — a successful delete just tells the parent
// to drop it from the list via onDeleted, rather than replacing it in
// place the way CommentItem's onChanged does for a Comment's soft-delete.
export default function ReplyItem({
  reply,
  authorLabel,
  canEdit,
  canDelete,
  onUpdated,
  onDeleted,
}: {
  reply: LessonReply;
  authorLabel: string;
  canEdit: boolean;
  canDelete: boolean;
  onUpdated: (updated: LessonReply) => void;
  onDeleted: (id: string) => void;
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
  } = useEditAndDelete<LessonReply>({
    initialBody: reply.body,
    onSave: (body) => updateReply(reply.id, body),
    onSaved: onUpdated,
    onDelete: () => deleteReply(reply.id),
    onDeleted: () => onDeleted(reply.id),
    saveErrorFallback: t("comments.couldNotSave"),
    deleteErrorFallback: t("comments.couldNotDeleteReply"),
  });

  return (
    <li>
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="text-[12.5px] font-bold">{authorLabel}</span>
        <span className="text-faint text-[11px]">
          {new Date(reply.created_at).toLocaleDateString()}
        </span>
      </div>

      {editing ? (
        <div>
          <textarea
            className="border-border focus:outline-brand min-h-[60px] w-full rounded-[11px] border bg-white px-3.5 py-2.5 text-[13px] leading-relaxed focus:outline-2 focus:outline-offset-1"
            value={editDraft}
            maxLength={COMMENT_BODY_MAX_LENGTH}
            onChange={(e) => setEditDraft(e.target.value)}
          />
          {saveError && <p className="text-brand-dark mt-2 text-[12px]">{saveError}</p>}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={saving || !editDraft.trim()}
              onClick={() => void handleSave()}
              className="bg-brand rounded-[11px] px-3.5 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-60"
            >
              {saving ? t("comments.saving") : t("comments.save")}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={cancelEdit}
              className="border-border rounded-[11px] border bg-white px-3.5 py-1.5 text-[12.5px] font-bold disabled:opacity-60"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{reply.body}</p>
      )}

      {!editing && (canEdit || canDelete) && (
        <div className="mt-1.5 flex gap-3">
          {canEdit && (
            <button
              type="button"
              onClick={startEdit}
              className="text-brand text-[12px] font-bold"
            >
              {t("comments.edit")}
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              disabled={deleting}
              onClick={() => void handleDeleteClick()}
              className="text-brand-dark text-[12px] font-bold disabled:opacity-60"
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
      {deleteError && <p className="text-brand-dark mt-1 text-[12px]">{deleteError}</p>}
    </li>
  );
}
