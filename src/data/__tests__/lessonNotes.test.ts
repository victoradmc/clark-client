import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { getMyNote, login, logout, saveNote } from "../clarkApi";
import { supabase } from "../supabaseClient";
import { ensureFixtureAccount, FIXTURE_PASSWORD, serviceRoleClient } from "./support";

const OWNER_EMAIL = "note-owner@clark.test";
const STUDENT_A_EMAIL = "note-student-a@clark.test";
const STUDENT_B_EMAIL = "note-student-b@clark.test";
const ADMIN_EMAIL = "note-admin@clark.test";

let ownerId: string;

beforeAll(async () => {
  ownerId = await ensureFixtureAccount(OWNER_EMAIL, "student", "Note Owner");
  await ensureFixtureAccount(STUDENT_A_EMAIL, "student", "Note Student A");
  await ensureFixtureAccount(STUDENT_B_EMAIL, "student", "Note Student B");
  await ensureFixtureAccount(ADMIN_EMAIL, "admin", "Note Admin");
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
      title: "Note Fixture Lesson",
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

async function notesCount(lessonId: string): Promise<number> {
  const { data, error } = await serviceRoleClient
    .from("lessons")
    .select("notes_count")
    .eq("id", lessonId)
    .single();
  if (error) throw error;
  return data.notes_count;
}

async function rowCount(lessonId: string): Promise<number> {
  const { count, error } = await serviceRoleClient
    .from("lesson_notes")
    .select("id", { count: "exact", head: true })
    .eq("lesson_id", lessonId);
  if (error) throw error;
  return count ?? 0;
}

describe("clarkApi.saveNote", () => {
  it("creates a Note on a public Lesson, incrementing notes_count", async () => {
    const id = await seedLesson();
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);

    const saved = await saveNote(id, "My first thought.");

    expect(saved?.content).toBe("My first thought.");
    expect(await notesCount(id)).toBe(1);
    expect(await rowCount(id)).toBe(1);
  });

  it("overwrites the existing Note on a second save rather than duplicating it", async () => {
    const id = await seedLesson();
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);

    await saveNote(id, "First draft.");
    const saved = await saveNote(id, "Revised draft.");

    expect(saved?.content).toBe("Revised draft.");
    expect(await rowCount(id)).toBe(1);
    expect(await notesCount(id)).toBe(1);
  });

  it("bumps updated_at on an overwrite", async () => {
    const id = await seedLesson();
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);

    const first = await saveNote(id, "First draft.");
    await new Promise((resolve) => setTimeout(resolve, 10));
    const second = await saveNote(id, "Revised draft.");

    expect(first?.updated_at).toBeDefined();
    expect(second?.updated_at).not.toBe(first?.updated_at);
  });

  it("deletes the row when saved with text that trims to empty", async () => {
    const id = await seedLesson();
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);
    await saveNote(id, "Something.");

    const result = await saveNote(id, "   ");

    expect(result).toBeNull();
    expect(await rowCount(id)).toBe(0);
    expect(await notesCount(id)).toBe(0);
  });

  it("is a no-op deleting when there was never a Note", async () => {
    const id = await seedLesson();
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);

    const result = await saveNote(id, "");

    expect(result).toBeNull();
    expect(await rowCount(id)).toBe(0);
  });

  it("succeeds for the owner taking a Note on their own private Lesson", async () => {
    const id = await seedLesson({ visibility: "private" });
    await login(OWNER_EMAIL, FIXTURE_PASSWORD);

    const saved = await saveNote(id, "Private thought.");

    expect(saved?.content).toBe("Private thought.");
  });

  it("succeeds for an Admin taking a Note on a private Lesson they don't own", async () => {
    const id = await seedLesson({ visibility: "private" });
    await login(ADMIN_EMAIL, FIXTURE_PASSWORD);

    const saved = await saveNote(id, "Admin's own note.");

    expect(saved?.content).toBe("Admin's own note.");
  });

  it("is rejected for a private Lesson the caller can't view", async () => {
    const id = await seedLesson({ visibility: "private" });
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);

    await expect(saveNote(id, "Sneaky note.")).rejects.toThrow();
    expect(await rowCount(id)).toBe(0);
  });

  it("keeps notes_count in sync across multiple Accounts noting the same Lesson", async () => {
    const id = await seedLesson();

    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);
    await saveNote(id, "A's note.");
    await logout();

    await login(STUDENT_B_EMAIL, FIXTURE_PASSWORD);
    await saveNote(id, "B's note.");
    expect(await notesCount(id)).toBe(2);

    // B clears their Note; A's Note is untouched.
    await saveNote(id, "");
    expect(await notesCount(id)).toBe(1);
  });
});

describe("clarkApi.getMyNote", () => {
  it("returns null when the caller has no Note on this Lesson", async () => {
    const id = await seedLesson();
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);

    expect(await getMyNote(id)).toBeNull();
  });

  it("returns the caller's own Note content", async () => {
    const id = await seedLesson();
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);
    await saveNote(id, "Remember this.");

    const note = await getMyNote(id);

    expect(note?.content).toBe("Remember this.");
  });

  it("returns null for a signed-out caller", async () => {
    const id = await seedLesson();
    expect(await getMyNote(id)).toBeNull();
  });
});

describe("lesson_notes unique constraint", () => {
  it("rejects a second row for the same (lesson, Account) pair", async () => {
    const id = await seedLesson();
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);

    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id;

    const first = await supabase
      .from("lesson_notes")
      .insert({ lesson_id: id, user_id: userId, content: "One." });
    expect(first.error).toBeNull();

    const second = await supabase
      .from("lesson_notes")
      .insert({ lesson_id: id, user_id: userId, content: "Two." });
    expect(second.error).not.toBeNull();

    expect(await rowCount(id)).toBe(1);
  });
});

describe("lesson_notes RLS boundary", () => {
  it("hides another Account's Note row from select, including an Admin's", async () => {
    const id = await seedLesson();
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);
    await saveNote(id, "Only for me.");
    await logout();

    await login(STUDENT_B_EMAIL, FIXTURE_PASSWORD);
    const { data: asOther } = await supabase
      .from("lesson_notes")
      .select("id")
      .eq("lesson_id", id);
    expect(asOther).toEqual([]);
    await logout();

    // The deliberate deviation from lesson_stars (ADR 0009): unlike Star,
    // an Admin gets no elevated read access to another Account's Note.
    await login(ADMIN_EMAIL, FIXTURE_PASSWORD);
    const { data: asAdmin } = await supabase
      .from("lesson_notes")
      .select("id")
      .eq("lesson_id", id);
    expect(asAdmin).toEqual([]);
  });

  it("blocks an Account, including an Admin, from updating another Account's Note row", async () => {
    const id = await seedLesson();
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);
    await saveNote(id, "Original.");
    await logout();

    await login(STUDENT_B_EMAIL, FIXTURE_PASSWORD);
    const asOther = await supabase
      .from("lesson_notes")
      .update({ content: "Tampered." }, { count: "exact" })
      .eq("lesson_id", id);
    expect(asOther.error === null && asOther.count === 0).toBe(true);
    await logout();

    await login(ADMIN_EMAIL, FIXTURE_PASSWORD);
    const asAdmin = await supabase
      .from("lesson_notes")
      .update({ content: "Tampered by Admin." }, { count: "exact" })
      .eq("lesson_id", id);
    expect(asAdmin.error === null && asAdmin.count === 0).toBe(true);

    const { data: unchanged } = await serviceRoleClient
      .from("lesson_notes")
      .select("content")
      .eq("lesson_id", id)
      .single();
    expect(unchanged?.content).toBe("Original.");
  });

  it("blocks an Account, including an Admin, from deleting another Account's Note row", async () => {
    const id = await seedLesson();
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);
    await saveNote(id, "Original.");
    await logout();

    await login(ADMIN_EMAIL, FIXTURE_PASSWORD);
    const { error, count } = await supabase
      .from("lesson_notes")
      .delete({ count: "exact" })
      .eq("lesson_id", id);
    expect(error === null && count === 0).toBe(true);

    expect(await rowCount(id)).toBe(1);
  });
});
