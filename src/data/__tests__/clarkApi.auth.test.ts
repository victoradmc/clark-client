import { beforeAll, afterEach, describe, expect, it } from "vitest";
import { getSession, login, logout } from "../clarkApi";
import { ensureFixtureAccount, FIXTURE_PASSWORD } from "./support";

const EMAIL = "auth-fixture@clark.test";

beforeAll(async () => {
  await ensureFixtureAccount(EMAIL, "student", "Auth Fixture");
});

afterEach(async () => {
  await logout();
});

describe("clarkApi auth", () => {
  it("has no session before logging in", async () => {
    expect(await getSession()).toBeNull();
  });

  it("rejects the wrong password and leaves no session", async () => {
    await expect(login(EMAIL, "not-the-password")).rejects.toThrow();
    expect(await getSession()).toBeNull();
  });

  it("logs in with correct credentials and getSession reflects it", async () => {
    await login(EMAIL, FIXTURE_PASSWORD);
    const session = await getSession();
    expect(session?.user.email).toBe(EMAIL);
  });

  it("logout clears the session", async () => {
    await login(EMAIL, FIXTURE_PASSWORD);
    await logout();
    expect(await getSession()).toBeNull();
  });
});
