export const COMMENT_BODY_MAX_LENGTH = 2000;

// Shared by the Comment composer/edit form (pre-network validation) and
// clarkApi.createComment/updateComment (the seam itself re-validates — same
// one-rule-set convention as validateLessonFields) so there is exactly one
// rule set. Mirrors the migration's check constraint: non-empty after
// trimming, capped at COMMENT_BODY_MAX_LENGTH.
export function validateCommentBody(body: unknown): string {
  if (typeof body !== "string" || !body.trim()) {
    throw new Error("A comment can't be empty.");
  }
  const trimmed = body.trim();
  if (trimmed.length > COMMENT_BODY_MAX_LENGTH) {
    throw new Error(`A comment can be at most ${COMMENT_BODY_MAX_LENGTH} characters.`);
  }
  return trimmed;
}
