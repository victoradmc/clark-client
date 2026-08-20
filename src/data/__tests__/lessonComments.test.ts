import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createComment,
  deleteComment,
  getLessonComments,
  login,
  logout,
  updateComment,
} from "../clarkApi";
import { COMMENT_BODY_MAX_LENGTH } from "../commentValidation";
import { ensureFixtureAccount, FIXTURE_PASSWORD, serviceRoleClient } from "./support";

const OWNER_EMAIL = "comment-owner@clark.test";
const STUDENT_A_EMAIL = "comment-student-a@clark.test";
const STUDENT_B_EMAIL = "comment-student-b@clark.test";
const ADMIN_EMAIL = "comment-admin@clark.test";

let ownerId: string;

beforeAll(async () => {
  ownerId = await ensureFixtureAccount(OWNER_EMAIL, "student", "Comment Owner");
  await ensureFixtureAccount(STUDENT_A_EMAIL, "student", "Comment Student A");
  await ensureFixtureAccount(STUDENT_B_EMAIL, "student", "Comment Student B");
  await ensureFixtureAccount(ADMIN_EMAIL, "admin", "Comment Admin");
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
      title: "Comment Fixture Lesson",
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

async function fetchRow(id: string) {
  const { data, error } = await serviceRoleClient
    .from("lesson_comments")
    .select()
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

describe("clarkApi.createComment", () => {
  it("lets any Account comment on a Lesson it can view", async () => {
    const id = await seedLesson();
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);

    const comment = await createComment(id, "  Great lesson, thanks!  ");

    expect(comment.lesson_id).toBe(id);
    expect(comment.body).toBe("Great lesson, thanks!");
    expect(comment.deleted_at).toBeNull();
    expect(await fetchRow(comment.id)).toMatchObject({ body: "Great lesson, thanks!" });
  });

  it("rejects commenting on a private Lesson the caller can't view", async () => {
    const id = await seedLesson({ visibility: "private" });
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);

    await expect(createComment(id, "Sneaky comment")).rejects.toThrow();
  });

  it("succeeds for the owner and an Admin on a private Lesson", async () => {
    const id = await seedLesson({ visibility: "private" });

    await login(OWNER_EMAIL, FIXTURE_PASSWORD);
    await expect(createComment(id, "Owner note")).resolves.toBeTruthy();
    await logout();

    await login(ADMIN_EMAIL, FIXTURE_PASSWORD);
    await expect(createComment(id, "Admin note")).resolves.toBeTruthy();
  });

  it("rejects an empty or whitespace-only body without a network round trip", async () => {
    const id = await seedLesson();
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);

    await expect(createComment(id, "   ")).rejects.toThrow();
  });

  it("rejects a body over the max length", async () => {
    const id = await seedLesson();
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);

    const tooLong = "a".repeat(COMMENT_BODY_MAX_LENGTH + 1);
    await expect(createComment(id, tooLong)).rejects.toThrow();
  });
});

describe("clarkApi.updateComment", () => {
  it("lets the author edit their own Comment", async () => {
    const id = await seedLesson();
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);
    const comment = await createComment(id, "Original text");

    const updated = await updateComment(comment.id, "Edited text");

    expect(updated.body).toBe("Edited text");
  });

  it("rejects a non-author's edit attempt", async () => {
    const id = await seedLesson();
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);
    const comment = await createComment(id, "Original text");
    await logout();

    await login(STUDENT_B_EMAIL, FIXTURE_PASSWORD);
    await expect(updateComment(comment.id, "Hijacked text")).rejects.toThrow();
    expect((await fetchRow(comment.id)).body).toBe("Original text");
  });

  it("rejects an Admin's edit attempt on someone else's Comment", async () => {
    const id = await seedLesson();
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);
    const comment = await createComment(id, "Original text");
    await logout();

    await login(ADMIN_EMAIL, FIXTURE_PASSWORD);
    await expect(updateComment(comment.id, "Admin-edited text")).rejects.toThrow();
    expect((await fetchRow(comment.id)).body).toBe("Original text");
  });
});

describe("clarkApi.deleteComment — tombstone behavior", () => {
  it("soft-deletes on the author's own delete, leaving the row and body intact", async () => {
    const id = await seedLesson();
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);
    const comment = await createComment(id, "About to be deleted");

    await deleteComment(comment.id);

    const row = await fetchRow(comment.id);
    expect(row.deleted_at).not.toBeNull();
    expect(row.body).toBe("About to be deleted");

    const comments = await getLessonComments(id);
    expect(comments.map((c) => c.id)).toContain(comment.id);
  });

  it("lets an Admin delete another Account's Comment", async () => {
    const id = await seedLesson();
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);
    const comment = await createComment(id, "Moderate me");
    await logout();

    await login(ADMIN_EMAIL, FIXTURE_PASSWORD);
    await deleteComment(comment.id);

    const row = await fetchRow(comment.id);
    expect(row.deleted_at).not.toBeNull();
  });

  it("rejects a non-author, non-Admin's delete attempt", async () => {
    const id = await seedLesson();
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);
    const comment = await createComment(id, "Leave me alone");
    await logout();

    await login(STUDENT_B_EMAIL, FIXTURE_PASSWORD);
    await expect(deleteComment(comment.id)).rejects.toThrow();
    expect((await fetchRow(comment.id)).deleted_at).toBeNull();
  });
});

describe("clarkApi.getLessonComments", () => {
  it("returns Comments newest-first", async () => {
    const id = await seedLesson();
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);
    const first = await createComment(id, "First comment");
    const second = await createComment(id, "Second comment");

    const comments = await getLessonComments(id);

    const ids = comments.map((c) => c.id);
    expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id));
  });

  it("follows the underlying Lesson's visibility — a non-owner can't read Comments on a private Lesson", async () => {
    const id = await seedLesson({ visibility: "private" });
    await login(OWNER_EMAIL, FIXTURE_PASSWORD);
    await createComment(id, "Private lesson comment");
    await logout();

    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);
    const comments = await getLessonComments(id);

    expect(comments).toEqual([]);
  });
});
