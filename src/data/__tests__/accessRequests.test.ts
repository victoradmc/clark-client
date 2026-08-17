import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  approveAccessRequest,
  getAccessRequests,
  login,
  logout,
  rejectAccessRequest,
  submitAccessRequest,
} from "../clarkApi";
import { supabase } from "../supabaseClient";
import { ensureFixtureAccount, FIXTURE_PASSWORD, serviceRoleClient } from "./support";

const ADMIN_EMAIL = "access-requests-admin@clark.test";
const STUDENT_EMAIL = "access-requests-student@clark.test";

beforeAll(async () => {
  await ensureFixtureAccount(ADMIN_EMAIL, "admin", "Access Requests Admin");
  await ensureFixtureAccount(STUDENT_EMAIL, "student", "Access Requests Student");
});

afterEach(async () => {
  await logout();
});

async function deleteRequest(email: string) {
  await serviceRoleClient.from("access_requests").delete().eq("email", email);
}

async function deleteAccountByEmail(email: string) {
  const { data } = await serviceRoleClient.auth.admin.listUsers();
  const existing = data.users.find((u) => u.email === email);
  if (existing) await serviceRoleClient.auth.admin.deleteUser(existing.id);
}

describe("clarkApi.submitAccessRequest", () => {
  it("lets a signed-out visitor submit a request", async () => {
    const email = "access-request-new@clark.test";
    try {
      await submitAccessRequest({
        name: "New Visitor",
        email,
        message: "Please let me in.",
      });

      const { data } = await serviceRoleClient
        .from("access_requests")
        .select()
        .eq("email", email)
        .single();
      expect(data).toMatchObject({
        name: "New Visitor",
        email,
        message: "Please let me in.",
      });
    } finally {
      await deleteRequest(email);
    }
  });

  it("stores a null message when none is given", async () => {
    const email = "access-request-no-message@clark.test";
    try {
      await submitAccessRequest({ name: "No Message", email });

      const { data } = await serviceRoleClient
        .from("access_requests")
        .select("message")
        .eq("email", email)
        .single();
      expect(data?.message).toBeNull();
    } finally {
      await deleteRequest(email);
    }
  });

  it("is rejected when a request is already pending for that email", async () => {
    const email = "access-request-duplicate@clark.test";
    try {
      await submitAccessRequest({ name: "First", email });
      await expect(
        submitAccessRequest({ name: "Second", email }),
      ).rejects.toThrow(/already pending/i);
    } finally {
      await deleteRequest(email);
    }
  });

  it("is rejected when an Account already exists for that email", async () => {
    await expect(
      submitAccessRequest({ name: "Existing", email: STUDENT_EMAIL }),
    ).rejects.toThrow(/account already exists/i);
  });
});

describe("clarkApi.getAccessRequests", () => {
  it("lists pending requests for an Admin", async () => {
    const email = "access-request-listed@clark.test";
    try {
      await submitAccessRequest({ name: "Listed", email });

      await login(ADMIN_EMAIL, FIXTURE_PASSWORD);
      const requests = await getAccessRequests();
      expect(requests.some((r) => r.email === email)).toBe(true);
    } finally {
      await deleteRequest(email);
    }
  });

  it("is rejected for a Student", async () => {
    await login(STUDENT_EMAIL, FIXTURE_PASSWORD);
    await expect(getAccessRequests()).rejects.toThrow();
  });
});

describe("clarkApi.approveAccessRequest", () => {
  it("invites the requester as a Student and removes the request", async () => {
    const email = "access-request-approve@clark.test";
    try {
      await submitAccessRequest({ name: "Approve Me", email });

      await login(ADMIN_EMAIL, FIXTURE_PASSWORD);
      const requests = await getAccessRequests();
      const request = requests.find((r) => r.email === email);
      if (!request) throw new Error("fixture request not found");

      const account = await approveAccessRequest(request);
      expect(account.email).toBe(email);
      expect(account.role).toBe("student");

      const { data: profileRow } = await serviceRoleClient
        .from("profiles")
        .select("role")
        .eq("id", account.id)
        .maybeSingle();
      expect(profileRow?.role).toBe("student");

      const { data: requestRow } = await serviceRoleClient
        .from("access_requests")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      expect(requestRow).toBeNull();
    } finally {
      await deleteRequest(email);
      await deleteAccountByEmail(email);
    }
  });

  it("is rejected for a Student", async () => {
    const email = "access-request-approve-unauthorized@clark.test";
    try {
      await submitAccessRequest({ name: "Blocked", email });

      await login(ADMIN_EMAIL, FIXTURE_PASSWORD);
      const requests = await getAccessRequests();
      const request = requests.find((r) => r.email === email);
      if (!request) throw new Error("fixture request not found");
      await logout();

      await login(STUDENT_EMAIL, FIXTURE_PASSWORD);
      await expect(approveAccessRequest(request)).rejects.toThrow();
    } finally {
      await deleteRequest(email);
      await deleteAccountByEmail(email);
    }
  });
});

describe("clarkApi.rejectAccessRequest", () => {
  it("removes the request without inviting anyone", async () => {
    const email = "access-request-reject@clark.test";
    try {
      await submitAccessRequest({ name: "Reject Me", email });

      await login(ADMIN_EMAIL, FIXTURE_PASSWORD);
      const requests = await getAccessRequests();
      const request = requests.find((r) => r.email === email);
      if (!request) throw new Error("fixture request not found");

      await rejectAccessRequest(request.id);

      const { data: requestRow } = await serviceRoleClient
        .from("access_requests")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      expect(requestRow).toBeNull();

      const { data: list } = await serviceRoleClient.auth.admin.listUsers();
      expect(list.users.some((u) => u.email === email)).toBe(false);
    } finally {
      await deleteRequest(email);
    }
  });

  it("is rejected for a Student", async () => {
    const email = "access-request-reject-unauthorized@clark.test";
    try {
      await submitAccessRequest({ name: "Blocked", email });

      await login(ADMIN_EMAIL, FIXTURE_PASSWORD);
      const requests = await getAccessRequests();
      const request = requests.find((r) => r.email === email);
      if (!request) throw new Error("fixture request not found");
      await logout();

      await login(STUDENT_EMAIL, FIXTURE_PASSWORD);
      await expect(rejectAccessRequest(request.id)).rejects.toThrow();
    } finally {
      await deleteRequest(email);
    }
  });
});

describe("access_requests RLS", () => {
  it("lets an unauthenticated client INSERT but not SELECT", async () => {
    const email = "access-request-rls-anon@clark.test";
    try {
      const { error: insertError } = await supabase
        .from("access_requests")
        .insert({ name: "RLS Check", email });
      expect(insertError).toBeNull();

      const { error: selectError } = await supabase.from("access_requests").select();
      expect(selectError).not.toBeNull();
    } finally {
      await deleteRequest(email);
    }
  });
});
