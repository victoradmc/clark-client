import { useState } from "react";
import { friendlyErrorMessage } from "../data/errorMessage";

// Shared shape for per-row async actions in a list UI (Admin's Accounts and
// Lessons tabs): clear that row's error, run the action, and on failure
// surface the server's message under that same row rather than a
// screen-wide error, since each row acts independently of the others.
export function useRowActions() {
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function run(
    id: string,
    action: () => Promise<void>,
    fallbackError: string,
  ) {
    setErrors((prev) => ({ ...prev, [id]: "" }));
    try {
      await action();
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [id]: friendlyErrorMessage(err, fallbackError),
      }));
    }
  }

  return { errors, run };
}
