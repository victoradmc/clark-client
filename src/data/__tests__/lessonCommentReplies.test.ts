import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createComment,
  createReply,
  deleteComment,
  deleteReply,
  getLessonComments,
  login,
  logout,
  updateReply,
} from "../clarkApi";
import { ensureFixtureAccount, FIXTURE_PASSWORD, serviceRoleClient } from "./support";

const OWNER_EMAIL = "reply-owner@clark.test";
const STUDENT_A_EMAIL = "reply-student-a@clark.test";
const STUDENT_B_EMAIL = "reply-student-b@clark.test";
const ADMIN_EMAIL = "reply-admin@clark.test";

let ownerId: string;

beforeAll(async () => {
  ownerId = await ensureFixtureAccount(OWNER_EMAIL, "student", "Reply Owner");
  await ensureFixtureAccount(STUDENT_A_EMAIL, "student", "Reply Student A");
  await ensureFixtureAccount(STUDENT_B_EMAIL, "student", "Reply Student B");
  await ensureFixtureAccount(ADMIN_EMAIL, "admin", "Reply Admin");
});

afterEach(async () => {
  await logout();
});

async function seedLesson(
  overrides: Partial<{ visibility: "public" | "private" }> = {},
): Promise<string> {
  const { data, error } = await serviceRoleClient
    .from("lessons")
    .insert({
      title: "Reply Fixture Lesson",
      content: "Content.",
      subject: "Test",
      visibility: "public",
      owner_id: ownerId,
      ...overrides,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function seedComment(lessonId: string): Promise<string> {
  const { data, error } = await serviceRoleClient
    .from("lesson_comments")
    .insert({ lesson_id: lessonId, author_id: ownerId, body: "Parent comment" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function fetchReplyRow(id: string) {
  const { data, error } = await serviceRoleClient
    .from("lesson_comment_replies")
    .select()
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

describe("clarkApi.createReply", () => {
  it("lets any Account reply to a Comment on a Lesson it can view", async () => {
    const lessonId = await seedLesson();
    const commentId = await seedComment(lessonId);
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);

    const reply = await createReply(commentId, "  Thanks for sharing!  ");

    expect(reply.comment_id).toBe(commentId);
    expect(reply.body).toBe("Thanks for sharing!");
    expect(await fetchReplyRow(reply.id)).toMatchObject({ body: "Thanks for sharing!" });
  });

  it("rejects replying on a private Lesson the caller can't view", async () => {
    const lessonId = await seedLesson({ visibility: "private" });
    const commentId = await seedComment(lessonId);
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);

    await expect(createReply(commentId, "Sneaky reply")).rejects.toThrow();
  });

  it("rejects an empty body without a network round trip", async () => {
    const lessonId = await seedLesson();
    const commentId = await seedComment(lessonId);
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);

    await expect(createReply(commentId, "   ")).rejects.toThrow();
  });

  it("has no code path letting a Reply's comment_id reference another Reply", async () => {
    const lessonId = await seedLesson();
    const commentId = await seedComment(lessonId);
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);
    const reply = await createReply(commentId, "First-level reply");

    // lesson_comment_replies.comment_id is a foreign key into
    // lesson_comments only — pointing it at a Reply's own id (a row that
    // exists, just in the wrong table) must fail at the database level,
    // not merely be blocked by application code.
    const { error } = await serviceRoleClient
      .from("lesson_comment_replies")
      .insert({ comment_id: reply.id, author_id: ownerId, body: "Reply to a reply" });

    expect(error).not.toBeNull();
  });
});

describe("clarkApi.updateReply", () => {
  it("lets the author edit their own Reply", async () => {
    const lessonId = await seedLesson();
    const commentId = await seedComment(lessonId);
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);
    const reply = await createReply(commentId, "Original reply");

    const updated = await updateReply(reply.id, "Edited reply");

    expect(updated.body).toBe("Edited reply");
  });

  it("rejects a non-author's edit attempt", async () => {
    const lessonId = await seedLesson();
    const commentId = await seedComment(lessonId);
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);
    const reply = await createReply(commentId, "Original reply");
    await logout();

    await login(STUDENT_B_EMAIL, FIXTURE_PASSWORD);
    await expect(updateReply(reply.id, "Hijacked reply")).rejects.toThrow();
    expect((await fetchReplyRow(reply.id))?.body).toBe("Original reply");
  });

  it("rejects an Admin's edit attempt on someone else's Reply", async () => {
    const lessonId = await seedLesson();
    const commentId = await seedComment(lessonId);
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);
    const reply = await createReply(commentId, "Original reply");
    await logout();

    await login(ADMIN_EMAIL, FIXTURE_PASSWORD);
    await expect(updateReply(reply.id, "Admin-edited reply")).rejects.toThrow();
    expect((await fetchReplyRow(reply.id))?.body).toBe("Original reply");
  });
});

describe("clarkApi.deleteReply — hard delete", () => {
  it("removes the row outright on the author's own delete", async () => {
    const lessonId = await seedLesson();
    const commentId = await seedComment(lessonId);
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);
    const reply = await createReply(commentId, "About to be deleted");

    await deleteReply(reply.id);

    expect(await fetchReplyRow(reply.id)).toBeNull();
  });

  it("lets an Admin delete another Account's Reply", async () => {
    const lessonId = await seedLesson();
    const commentId = await seedComment(lessonId);
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);
    const reply = await createReply(commentId, "Moderate me");
    await logout();

    await login(ADMIN_EMAIL, FIXTURE_PASSWORD);
    await deleteReply(reply.id);

    expect(await fetchReplyRow(reply.id)).toBeNull();
  });

  it("rejects a non-author, non-Admin's delete attempt", async () => {
    const lessonId = await seedLesson();
    const commentId = await seedComment(lessonId);
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);
    const reply = await createReply(commentId, "Leave me alone");
    await logout();

    await login(STUDENT_B_EMAIL, FIXTURE_PASSWORD);
    await expect(deleteReply(reply.id)).rejects.toThrow();
    expect(await fetchReplyRow(reply.id)).not.toBeNull();
  });
});

describe("clarkApi.getLessonComments — nested Replies", () => {
  it("nests each Comment's Replies inline, oldest-first", async () => {
    const lessonId = await seedLesson();
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);
    const comment = await createComment(lessonId, "Parent comment for nesting");
    const first = await createReply(comment.id, "First reply");
    const second = await createReply(comment.id, "Second reply");

    const comments = await getLessonComments(lessonId);

    const found = comments.find((c) => c.id === comment.id);
    expect(found?.replies.map((r) => r.id)).toEqual([first.id, second.id]);
  });

  it("keeps a soft-deleted (tombstoned) Comment's Replies nested and intact", async () => {
    // ADR 0008 / spec story 20: a Comment's soft-delete must never orphan
    // Replies underneath it — confirm that end to end through
    // getLessonComments, not just by inspecting the row directly.
    const lessonId = await seedLesson();
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);
    const comment = await createComment(lessonId, "About to be tombstoned");
    const reply = await createReply(comment.id, "Reply that must survive");

    await deleteComment(comment.id);
    const comments = await getLessonComments(lessonId);

    const found = comments.find((c) => c.id === comment.id);
    expect(found?.deleted_at).not.toBeNull();
    expect(found?.replies.map((r) => r.id)).toEqual([reply.id]);
  });

  it("returns an empty replies array for a Comment with none", async () => {
    const lessonId = await seedLesson();
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);
    const comment = await createComment(lessonId, "No replies here");

    const comments = await getLessonComments(lessonId);

    expect(comments.find((c) => c.id === comment.id)?.replies).toEqual([]);
  });

  it("keeps each Comment's Replies scoped to their own parent", async () => {
    const lessonId = await seedLesson();
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);
    const commentOne = await createComment(lessonId, "Comment one");
    const commentTwo = await createComment(lessonId, "Comment two");
    const replyOne = await createReply(commentOne.id, "Reply to comment one");
    const replyTwo = await createReply(commentTwo.id, "Reply to comment two");

    const comments = await getLessonComments(lessonId);

    expect(comments.find((c) => c.id === commentOne.id)?.replies.map((r) => r.id)).toEqual([
      replyOne.id,
    ]);
    expect(comments.find((c) => c.id === commentTwo.id)?.replies.map((r) => r.id)).toEqual([
      replyTwo.id,
    ]);
  });
});
