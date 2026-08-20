import { useState } from "react";
import { friendlyErrorMessage } from "../data/errorMessage";

// Shared by CommentItem and ReplyItem: both need the identical
// inline-edit-in-place / click-twice-to-confirm-delete state machine for a
// single body of text, wired to different clarkApi calls and error copy.
// `initialBody` is read fresh on every startEdit() call (not captured once
// at mount) so re-opening the editor after a save resets to the latest
// body, not a stale one from the first render — same "seeded from current
// props" convention StarButton documents for its own local state.
// TSaved/TDeleted are separate type params, not one shared T: a save
// always returns the updated row (CommentItem and ReplyItem agree here),
// but delete doesn't — deleteComment returns the row (soft-delete, for the
// tombstone) while deleteReply returns void (hard-delete, nothing left to
// return).
export function useEditAndDelete<TSaved, TDeleted = void>({
  initialBody,
  onSave,
  onSaved,
  onDelete,
  onDeleted,
  saveErrorFallback,
  deleteErrorFallback,
}: {
  initialBody: string;
  onSave: (body: string) => Promise<TSaved>;
  onSaved: (updated: TSaved) => void;
  onDelete: () => Promise<TDeleted>;
  onDeleted: (result: TDeleted) => void;
  saveErrorFallback: string;
  deleteErrorFallback: string;
}) {
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(initialBody);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function startEdit() {
    setEditDraft(initialBody);
    setSaveError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
  }

  async function handleSave() {
    if (saving || !editDraft.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await onSave(editDraft);
      onSaved(updated);
      setEditing(false);
    } catch (err) {
      setSaveError(friendlyErrorMessage(err, saveErrorFallback));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteClick() {
    if (!deleteConfirming) {
      setDeleteConfirming(true);
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      const result = await onDelete();
      onDeleted(result);
    } catch (err) {
      setDeleting(false);
      setDeleteConfirming(false);
      setDeleteError(friendlyErrorMessage(err, deleteErrorFallback));
    }
  }

  return {
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
  };
}
