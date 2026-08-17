import { useState } from "react";
import { friendlyErrorMessage } from "../data/errorMessage";

// Shared shape for per-row async actions in a list UI (Admin's Accounts and
// Lessons tabs): clear that row's error, mark it pending so its button can
// disable itself for the duration of the request (a double-click can't fire
// the action twice), and on failure surface the server's message under that
// same row rather than a screen-wide error, since each row acts
// independently of the others. Call this once per distinct action (e.g.
// Role change vs. password reset vs. delete) rather than sharing one
// instance across all of a row's actions, so a request in flight for one
// action doesn't disable an unrelated one on the same row.
export function useRowActions() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});

  async function run(
    id: string,
    action: () => Promise<void>,
    fallbackError: string,
  ) {
    setErrors((prev) => ({ ...prev, [id]: "" }));
    setPending((prev) => ({ ...prev, [id]: true }));
    try {
      await action();
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [id]: friendlyErrorMessage(err, fallbackError),
      }));
    } finally {
      setPending((prev) => ({ ...prev, [id]: false }));
    }
  }

  return { errors, pending, run };
}
