import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { getMyNotes, login, logout, saveNote } from "../clarkApi";
import { ensureFixtureAccount, FIXTURE_PASSWORD, serviceRoleClient } from "./support";

// getMyNotes backs the My Notes tab (ticket 04) — the caller's own Notes
// joined with their parent Lesson's title/Subject, most-recently-updated
// first, silently dropping any Note whose Lesson has since become invisible
// to the caller.

const OWNER_EMAIL = "mynotes-owner@clark.test";
const NOTER_EMAIL = "mynotes-noter@clark.test";
const OTHER_NOTER_EMAIL = "mynotes-other-noter@clark.test";

let ownerId: string;
let noterId: string;

beforeAll(async () => {
  ownerId = await ensureFixtureAccount(OWNER_EMAIL, "student", "My Notes Owner");
  noterId = await ensureFixtureAccount(NOTER_EMAIL, "student", "My Notes Noter");
  await ensureFixtureAccount(OTHER_NOTER_EMAIL, "student", "My Notes Other Noter");
});

afterEach(async () => {
  await logout();
});

async function seedLesson(
  overrides: Partial<{ title: string; subject: string; visibility: "public" | "private"; owner_id: string }> = {},
): Promise<string> {
  const { data, error } = await serviceRoleClient
    .from("lessons")
    .insert({
      title: "My Notes Fixture Lesson",
      content: "Content.",
      subject: "My Notes Fixture",
      visibility: "public",
      owner_id: ownerId,
      ...overrides,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

describe("clarkApi.getMyNotes", () => {
  it("returns the caller's own Notes joined with their Lesson's title and Subject", async () => {
    const id = await seedLesson({
      title: "Photosynthesis Basics",
      subject: "My Notes Fixture Biology",
    });
    await login(NOTER_EMAIL, FIXTURE_PASSWORD);
    await saveNote(id, "Plants make their own food.");

    const notes = await getMyNotes();
    const entry = notes.find((n) => n.lesson_id === id);

    expect(entry).toMatchObject({
      lesson_id: id,
      content: "Plants make their own food.",
      lesson_title: "Photosynthesis Basics",
      lesson_subject: "My Notes Fixture Biology",
    });
    expect(entry?.updated_at).toBeDefined();
  });

  it("never includes another Account's Notes", async () => {
    const id = await seedLesson({ subject: "My Notes Fixture Isolation" });
    await login(OTHER_NOTER_EMAIL, FIXTURE_PASSWORD);
    await saveNote(id, "Someone else's note.");
    await logout();

    await login(NOTER_EMAIL, FIXTURE_PASSWORD);
    const notes = await getMyNotes();

    expect(notes.some((n) => n.lesson_id === id)).toBe(false);
  });

  it("orders by updated_at descending, most recently updated first", async () => {
    const subject = "My Notes Fixture Ordering";
    const idA = await seedLesson({ title: "Ordering Fixture A", subject });
    const idB = await seedLesson({ title: "Ordering Fixture B", subject });
    await login(NOTER_EMAIL, FIXTURE_PASSWORD);

    await saveNote(idA, "First note.");
    await new Promise((resolve) => setTimeout(resolve, 10));
    await saveNote(idB, "Second note.");
    await new Promise((resolve) => setTimeout(resolve, 10));
    // Re-saving A bumps its updated_at above B's.
    await saveNote(idA, "First note, revised.");

    const notes = await getMyNotes();
    const ids = notes.map((n) => n.lesson_id).filter((lid) => lid === idA || lid === idB);

    expect(ids).toEqual([idA, idB]);
  });

  it("drops a Note whose Lesson has been deleted (lesson_notes cascade)", async () => {
    const id = await seedLesson({ subject: "My Notes Fixture Cascade" });
    await login(NOTER_EMAIL, FIXTURE_PASSWORD);
    await saveNote(id, "About to lose its Lesson.");

    const before = await getMyNotes();
    expect(before.some((n) => n.lesson_id === id)).toBe(true);

    await logout();
    const { error } = await serviceRoleClient.from("lessons").delete().eq("id", id);
    if (error) throw error;

    await login(NOTER_EMAIL, FIXTURE_PASSWORD);
    const after = await getMyNotes();
    expect(after.some((n) => n.lesson_id === id)).toBe(false);
  });

  it("drops a Note whose Lesson has been turned Private by its (other) owner", async () => {
    const id = await seedLesson({ subject: "My Notes Fixture Privacy" });
    await login(NOTER_EMAIL, FIXTURE_PASSWORD);
    await saveNote(id, "Taken while still Public.");

    const before = await getMyNotes();
    expect(before.some((n) => n.lesson_id === id)).toBe(true);
    await logout();

    const { error } = await serviceRoleClient
      .from("lessons")
      .update({ visibility: "private" })
      .eq("id", id);
    if (error) throw error;

    await login(NOTER_EMAIL, FIXTURE_PASSWORD);
    const after = await getMyNotes();
    expect(after.some((n) => n.lesson_id === id)).toBe(false);

    // The underlying Note row survives untouched — the Lesson's own RLS is
    // what hides it from this list, not a delete.
    const { data: stillThere } = await serviceRoleClient
      .from("lesson_notes")
      .select("id")
      .eq("lesson_id", id)
      .eq("user_id", noterId);
    expect(stillThere).toHaveLength(1);
  });

  it("returns an empty array for a signed-out caller", async () => {
    expect(await getMyNotes()).toEqual([]);
  });
});
