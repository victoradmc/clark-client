import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { getHelpTutorial, login, logout, updateHelpTutorial } from "../clarkApi";
import { ensureFixtureAccount, FIXTURE_PASSWORD, serviceRoleClient } from "./support";

const ADMIN_EMAIL = "tutorial-admin@clark.test";
const STUDENT_EMAIL = "tutorial-student@clark.test";

beforeAll(async () => {
  await ensureFixtureAccount(ADMIN_EMAIL, "admin", "Tutorial Admin");
  await ensureFixtureAccount(STUDENT_EMAIL, "student", "Tutorial Student");
});

afterEach(async () => {
  await logout();
});

describe("clarkApi.getHelpTutorial", () => {
  it("is readable by any signed-in Account", async () => {
    await login(STUDENT_EMAIL, FIXTURE_PASSWORD);
    const tutorial = await getHelpTutorial();
    expect(typeof tutorial.content).toBe("string");
  });
});

describe("clarkApi.updateHelpTutorial", () => {
  it("lets an Admin overwrite the Tutorial's content", async () => {
    await login(ADMIN_EMAIL, FIXTURE_PASSWORD);
    const original = await getHelpTutorial();
    try {
      const updated = await updateHelpTutorial("# Welcome\n\nThis is the tutorial.");
      expect(updated.content).toBe("# Welcome\n\nThis is the tutorial.");

      const reread = await getHelpTutorial();
      expect(reread.content).toBe("# Welcome\n\nThis is the tutorial.");
    } finally {
      // restore fixture state for reruns against the persistent local DB
      await serviceRoleClient
        .from("help_tutorial")
        .update({ content: original.content })
        .eq("id", 1);
    }
  });

  it("is rejected for a Student", async () => {
    await login(STUDENT_EMAIL, FIXTURE_PASSWORD);
    await expect(updateHelpTutorial("hacked")).rejects.toThrow();
  });
});
