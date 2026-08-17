// Every catch block that surfaces a thrown error to the user routes through
// this instead of trusting the error's own text. A thrown value here is
// rarely a real `Error`: supabase-js's default (non-`throwOnError`) query
// mode throws the raw parsed PostgREST error body, a plain `{message, code,
// details, hint}` object — `PostgrestError extends Error` only applies when
// `.throwOnError()` is explicitly opted into, which this codebase never
// does. And even when it is a real Error (a validation failure, an Auth
// error), its message is developer-facing English, not something to show a
// Student or Admin, translated or not. So this never inspects the error's
// shape or text for display — it always returns the given fallback, and
// logs the original for debugging.
export function friendlyErrorMessage(err: unknown, fallback: string): string {
  console.error(err);
  return fallback;
}
