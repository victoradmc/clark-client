import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { getOwnerNames, login, logout } from "../clarkApi";
import { ensureFixtureAccount, FIXTURE_PASSWORD } from "./support";

const VIEWER_EMAIL = "owner-names-viewer@clark.test";
const OWNER_EMAIL = "owner-names-owner@clark.test";
let ownerId: string;

beforeAll(async () => {
  await ensureFixtureAccount(VIEWER_EMAIL, "student", "Viewer");
  ownerId = await ensureFixtureAccount(OWNER_EMAIL, "student", "Named Owner");
});

afterEach(async () => {
  await logout();
});

describe("clarkApi.getOwnerNames", () => {
  it("resolves another Account's display name, even though profiles RLS wouldn't allow reading their row directly", async () => {
    await login(VIEWER_EMAIL, FIXTURE_PASSWORD);
    const names = await getOwnerNames([ownerId]);
    expect(names[ownerId]).toBe("Named Owner");
  });

  it("returns an empty map for an empty input without a network round-trip", async () => {
    await login(VIEWER_EMAIL, FIXTURE_PASSWORD);
    expect(await getOwnerNames([])).toEqual({});
  });
});
