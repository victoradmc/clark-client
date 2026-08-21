import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { getLessonsForSubject, getSubjectSummaries, login, logout } from "../clarkApi";
import { ensureFixtureAccount, FIXTURE_PASSWORD, serviceRoleClient } from "./support";

const OWNER_EMAIL = "subject-owner@clark.test";
const OTHER_EMAIL = "subject-other@clark.test";

let ownerId: string;
let otherId: string;

beforeAll(async () => {
  ownerId = await ensureFixtureAccount(OWNER_EMAIL, "student", "Subject Owner");
  otherId = await ensureFixtureAccount(OTHER_EMAIL, "student", "Subject Other");

  // ensureFixtureAccount is idempotent across repeated runs against the
  // persistent local DB, but Lesson rows aren't — clear this fixture's own
  // Lessons first so re-running the suite doesn't duplicate them.
  const { error: deleteError } = await serviceRoleClient
    .from("lessons")
    .delete()
    .in("owner_id", [ownerId, otherId]);
  if (deleteError) throw deleteError;

  const { error } = await serviceRoleClient.from("lessons").insert([
    {
      title: "Subj Browsing Biology Basics",
      content: "Content.",
      subject: "Subj Browsing Biology",
      visibility: "public",
      owner_id: ownerId,
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      title: "Whitespace Biology",
      content: "Content.",
      subject: "subj browsing biology ",
      visibility: "public",
      owner_id: ownerId,
      created_at: "2026-01-02T00:00:00Z",
    },
    {
      title: "Case Biology",
      content: "Content.",
      subject: " SUBJ BROWSING BIOLOGY",
      visibility: "public",
      owner_id: ownerId,
      created_at: "2026-01-03T00:00:00Z",
    },
    {
      title: "Owner Private Math",
      content: "Content.",
      subject: "Subj Browsing Math",
      visibility: "private",
      owner_id: ownerId,
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      title: "Other Private Chemistry",
      content: "Content.",
      subject: "Subj Browsing Chemistry",
      visibility: "private",
      owner_id: otherId,
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      title: "Other Public Chemistry",
      content: "Content.",
      subject: "Subj Browsing Chemistry",
      visibility: "public",
      owner_id: otherId,
      created_at: "2026-01-01T00:00:00Z",
    },
  ]);
  if (error) throw error;
});

afterEach(async () => {
  await logout();
});

describe("clarkApi.getSubjectSummaries", () => {
  it("collapses case/whitespace variants into one group, labeled with the most recent Lesson's literal Subject", async () => {
    await login(OWNER_EMAIL, FIXTURE_PASSWORD);

    const summaries = await getSubjectSummaries();
    const biology = summaries.find(
      (s) => s.subject.trim().toLowerCase() === "subj browsing biology",
    );

    expect(biology).toEqual({ subject: " SUBJ BROWSING BIOLOGY", lessonCount: 3 });
  });

  it("scopes counts to Public Lessons plus the caller's own, excluding another Account's private Lessons", async () => {
    await login(OWNER_EMAIL, FIXTURE_PASSWORD);

    const summaries = await getSubjectSummaries();
    const math = summaries.find((s) => s.subject === "Subj Browsing Math");
    const chemistry = summaries.find((s) => s.subject === "Subj Browsing Chemistry");

    // Math is the owner's own private Lesson — visible.
    expect(math).toEqual({ subject: "Subj Browsing Math", lessonCount: 1 });
    // Chemistry has one of Other's Lessons public and one private — only
    // the public one should count for a caller who isn't its owner.
    expect(chemistry).toEqual({ subject: "Subj Browsing Chemistry", lessonCount: 1 });
  });

  it("returns results sorted alphabetically by normalized Subject", async () => {
    await login(OWNER_EMAIL, FIXTURE_PASSWORD);

    const summaries = await getSubjectSummaries();
    const labels = summaries.map((s) => s.subject.trim().toLowerCase());

    expect(labels).toEqual([...labels].sort());
  });
});

describe("clarkApi.getLessonsForSubject", () => {
  it("matches Lessons across case/whitespace Subject variants, newest-first", async () => {
    await login(OWNER_EMAIL, FIXTURE_PASSWORD);

    const lessons = await getLessonsForSubject("subj browsing biology");

    expect(lessons.map((l) => l.title)).toEqual([
      "Case Biology",
      "Whitespace Biology",
      "Subj Browsing Biology Basics",
    ]);
  });

  it("includes Public Lessons plus the caller's own, excluding another Account's private Lesson", async () => {
    await login(OWNER_EMAIL, FIXTURE_PASSWORD);

    const lessons = await getLessonsForSubject("Subj Browsing Chemistry");

    expect(lessons.map((l) => l.title)).toEqual(["Other Public Chemistry"]);
  });

  it("returns the caller's own private Lesson for that Subject", async () => {
    await login(OWNER_EMAIL, FIXTURE_PASSWORD);

    const lessons = await getLessonsForSubject("Subj Browsing Math");

    expect(lessons.map((l) => l.title)).toEqual(["Owner Private Math"]);
  });

  it("returns an empty list for an unrecognized Subject, rather than erroring", async () => {
    await login(OWNER_EMAIL, FIXTURE_PASSWORD);

    const lessons = await getLessonsForSubject("Not A Real Subject");

    expect(lessons).toEqual([]);
  });

  it("returns an empty list for an empty Subject name", async () => {
    await login(OWNER_EMAIL, FIXTURE_PASSWORD);

    const lessons = await getLessonsForSubject("");

    expect(lessons).toEqual([]);
  });
});
