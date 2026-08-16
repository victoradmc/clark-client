import { afterEach, describe, expect, it } from "vitest";
import {
  changePassword,
  deleteOwnAccount,
  getProfile,
  getSession,
  login,
  logout,
  updateProfile,
} from "../clarkApi";
import { ensureFixtureAccount, FIXTURE_PASSWORD, serviceRoleClient } from "./support";

afterEach(async () => {
  await logout();
});

describe("clarkApi.updateProfile", () => {
  it("persists name, email, bio, and locale for the caller's own profile", async () => {
    await ensureFixtureAccount(
      "profile-update@clark.test",
      "student",
      "Original Name",
    );
    await login("profile-update@clark.test", FIXTURE_PASSWORD);

    const updated = await updateProfile({
      name: "New Name",
      email: "new-address@clark.test",
      bio: "A short bio.",
      locale: "pt-BR",
    });

    expect(updated.name).toBe("New Name");
    expect(updated.email).toBe("new-address@clark.test");
    expect(updated.bio).toBe("A short bio.");
    expect(updated.locale).toBe("pt-BR");

    // Round-trips through getProfile(), not just the update response.
    const fetched = await getProfile();
    expect(fetched).toEqual(updated);
  });

  it("defaults locale to 'en' for a newly-created Account", async () => {
    await ensureFixtureAccount(
      "profile-locale-default@clark.test",
      "student",
      "Default Locale",
    );
    await login("profile-locale-default@clark.test", FIXTURE_PASSWORD);
    expect((await getProfile()).locale).toBe("en");
  });
});

describe("clarkApi.changePassword", () => {
  it("updates the Account's Supabase Auth password", async () => {
    const id = await ensureFixtureAccount(
      "profile-password@clark.test",
      "student",
      "Password Changer",
    );
    await login("profile-password@clark.test", FIXTURE_PASSWORD);

    await changePassword("a-new-strong-password-1");
    await logout();

    await login("profile-password@clark.test", "a-new-strong-password-1");
    const session = await getSession();
    expect(session?.user.id).toBe(id);

    // Restore the shared fixture password so other tests reusing
    // ensureFixtureAccount (which never resets passwords) keep working.
    await serviceRoleClient.auth.admin.updateUserById(id, {
      password: FIXTURE_PASSWORD,
    });
  });
});

describe("clarkApi.deleteOwnAccount", () => {
  it("cascades to remove the profile and every Lesson it owned, and signs out", async () => {
    const id = await ensureFixtureAccount(
      "profile-delete@clark.test",
      "student",
      "Deleter",
    );
    const { error: lessonError } = await serviceRoleClient
      .from("lessons")
      .insert({
        title: "Owned By Deleter",
        content: "Content.",
        subject: "Test",
        visibility: "private",
        owner_id: id,
      })
      .select("id")
      .single();
    if (lessonError) throw lessonError;

    await login("profile-delete@clark.test", FIXTURE_PASSWORD);
    await deleteOwnAccount();

    expect(await getSession()).toBeNull();

    const { data: profileRow } = await serviceRoleClient
      .from("profiles")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    expect(profileRow).toBeNull();

    const { data: lessonRows } = await serviceRoleClient
      .from("lessons")
      .select("id")
      .eq("owner_id", id);
    expect(lessonRows).toEqual([]);
  });
});
