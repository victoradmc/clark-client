import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createChangelogEntry,
  deleteChangelogEntry,
  getChangelogEntries,
  login,
  logout,
  updateChangelogEntry,
} from "../clarkApi";
import { ensureFixtureAccount, FIXTURE_PASSWORD, serviceRoleClient } from "./support";

const ADMIN_EMAIL = "changelog-admin@clark.test";
const STUDENT_EMAIL = "changelog-student@clark.test";

beforeAll(async () => {
  await ensureFixtureAccount(ADMIN_EMAIL, "admin", "Changelog Admin");
  await ensureFixtureAccount(STUDENT_EMAIL, "student", "Changelog Student");
});

afterEach(async () => {
  await logout();
});

// All rows created by this file's own tests, cleaned up per-test — other
// test files' fixture data may also live in this shared table, so ordering
// assertions below only check relative order among this test's own rows.
async function deleteEntry(id: string) {
  await serviceRoleClient.from("changelog_entries").delete().eq("id", id);
}

describe("clarkApi.getChangelogEntries", () => {
  it("lists entries newest-first by entry_date, readable by any signed-in Account", async () => {
    await login(ADMIN_EMAIL, FIXTURE_PASSWORD);
    const older = await createChangelogEntry({
      version: "0.1.0",
      entry_date: "2026-01-01",
      body: "Older entry.",
    });
    const newer = await createChangelogEntry({
      version: "0.2.0",
      entry_date: "2026-06-01",
      body: "Newer entry.",
    });

    try {
      await logout();
      await login(STUDENT_EMAIL, FIXTURE_PASSWORD);
      const entries = await getChangelogEntries();

      const olderIndex = entries.findIndex((e) => e.id === older.id);
      const newerIndex = entries.findIndex((e) => e.id === newer.id);
      expect(olderIndex).toBeGreaterThanOrEqual(0);
      expect(newerIndex).toBeGreaterThanOrEqual(0);
      expect(newerIndex).toBeLessThan(olderIndex);
    } finally {
      await deleteEntry(older.id);
      await deleteEntry(newer.id);
    }
  });
});

describe("clarkApi.createChangelogEntry", () => {
  it("lets an Admin create an entry with version, date, and Markdown body", async () => {
    await login(ADMIN_EMAIL, FIXTURE_PASSWORD);
    const entry = await createChangelogEntry({
      version: "1.0.0",
      entry_date: "2026-08-17",
      body: "# Launch\n\nInitial release.",
    });
    try {
      expect(entry).toMatchObject({
        version: "1.0.0",
        entry_date: "2026-08-17",
        body: "# Launch\n\nInitial release.",
      });
    } finally {
      await deleteEntry(entry.id);
    }
  });

  it("is rejected for a Student", async () => {
    await login(STUDENT_EMAIL, FIXTURE_PASSWORD);
    await expect(
      createChangelogEntry({
        version: "1.0.0",
        entry_date: "2026-08-17",
        body: "hacked",
      }),
    ).rejects.toThrow();
  });
});

describe("clarkApi.updateChangelogEntry", () => {
  it("lets an Admin overwrite an entry in place", async () => {
    await login(ADMIN_EMAIL, FIXTURE_PASSWORD);
    const entry = await createChangelogEntry({
      version: "1.0.0",
      entry_date: "2026-08-17",
      body: "Original body.",
    });
    try {
      const updated = await updateChangelogEntry(entry.id, {
        version: "1.0.1",
        entry_date: "2026-08-18",
        body: "Updated body.",
      });
      expect(updated).toMatchObject({
        version: "1.0.1",
        entry_date: "2026-08-18",
        body: "Updated body.",
      });
    } finally {
      await deleteEntry(entry.id);
    }
  });

  it("is rejected for a Student", async () => {
    await login(ADMIN_EMAIL, FIXTURE_PASSWORD);
    const entry = await createChangelogEntry({
      version: "1.0.0",
      entry_date: "2026-08-17",
      body: "Original body.",
    });
    try {
      await logout();
      await login(STUDENT_EMAIL, FIXTURE_PASSWORD);
      await expect(
        updateChangelogEntry(entry.id, {
          version: "hacked",
          entry_date: "2026-08-17",
          body: "hacked",
        }),
      ).rejects.toThrow();
    } finally {
      await deleteEntry(entry.id);
    }
  });
});

describe("clarkApi.deleteChangelogEntry", () => {
  it("lets an Admin delete an entry", async () => {
    await login(ADMIN_EMAIL, FIXTURE_PASSWORD);
    const entry = await createChangelogEntry({
      version: "1.0.0",
      entry_date: "2026-08-17",
      body: "To be deleted.",
    });
    await deleteChangelogEntry(entry.id);

    const { data } = await serviceRoleClient
      .from("changelog_entries")
      .select("id")
      .eq("id", entry.id)
      .maybeSingle();
    expect(data).toBeNull();
  });

  it("is rejected for a Student", async () => {
    await login(ADMIN_EMAIL, FIXTURE_PASSWORD);
    const entry = await createChangelogEntry({
      version: "1.0.0",
      entry_date: "2026-08-17",
      body: "Protected.",
    });
    try {
      await logout();
      await login(STUDENT_EMAIL, FIXTURE_PASSWORD);
      await expect(deleteChangelogEntry(entry.id)).rejects.toThrow();
    } finally {
      await deleteEntry(entry.id);
    }
  });
});
