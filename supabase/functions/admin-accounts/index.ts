// The privileged Edge Function (ADR 0002, ticket 07): the only place the
// `service_role` key exists, and the only way to invite or delete an
// Account. Exposes exactly two actions, matching ADR 0002's "not a
// general-purpose backend" scope.
//
// Role changes on *existing* Accounts deliberately do NOT go through here —
// spec.md: "a plain RLS-gated `profiles` table update an Admin can perform
// directly from the client." Only invite and delete need the Auth Admin API.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header." }, 401);

  // Identifies the caller from their own session JWT — never trusted from
  // the request body, so a caller can't claim to be someone else.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user: caller },
    error: callerError,
  } = await callerClient.auth.getUser();
  if (callerError || !caller) return json({ error: "Not signed in." }, 401);

  // service_role from here on — bypasses RLS entirely, so every check the
  // rest of this function makes is load-bearing.
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: callerProfile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", caller.id)
    .single();
  if (callerProfile?.role !== "admin") {
    return json({ error: "Admin Role required." }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Expected a JSON body." }, 400);
  }

  if (body.action === "invite") {
    const { name, email, role } = body;
    if (
      typeof name !== "string" || !name.trim() ||
      typeof email !== "string" || !email.trim() ||
      (role !== "student" && role !== "admin")
    ) {
      return json(
        { error: "Expected name, email, and role ('student' or 'admin')." },
        400,
      );
    }

    const { data: invited, error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(email);
    if (inviteError || !invited.user) {
      return json({ error: inviteError?.message ?? "Could not invite this Account." }, 400);
    }

    const { error: profileError } = await adminClient.from("profiles").insert({
      id: invited.user.id,
      name,
      email,
      role,
    });
    if (profileError) {
      return json({ error: profileError.message }, 400);
    }

    return json({ id: invited.user.id, name, email, role, status: "invited" });
  }

  if (body.action === "delete") {
    const { id } = body;
    if (typeof id !== "string" || !id) {
      return json({ error: "Expected an Account id." }, 400);
    }
    // The DB trigger's self-action check is exempted for service_role calls
    // (it can't tell which Admin is behind an Admin API call) — this check
    // is the only place "an Admin can't delete their own Account" is
    // actually enforced for this path. The last-remaining-admin check has
    // no such exemption, so that one still fires from deleteUser() below.
    if (id === caller.id) {
      return json({ error: "You cannot delete your own Account." }, 400);
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(id);
    if (deleteError) {
      return json({ error: deleteError.message }, 400);
    }

    return json({ id });
  }

  return json({ error: "Unknown action." }, 400);
});
