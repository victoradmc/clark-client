import type { Question } from "./clarkApi";

// Shared by the Upload Test screen (pre-network validation on parse) and
// clarkApi.publishTest (the seam itself re-validates — mirrors
// lessonValidation's pattern) so there is exactly one rule set.
export function validateTestFields(input: unknown): Question[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error("Expected a non-empty array of questions.");
  }

  return input.map((raw, i) => {
    const n = i + 1;
    if (typeof raw !== "object" || raw === null) {
      throw new Error(
        `Question ${n} must be an object with question, options, and answer.`,
      );
    }

    const { question, options, answer } = raw as Record<string, unknown>;

    if (typeof question !== "string" || !question.trim()) {
      throw new Error(`Question ${n} is missing its question text.`);
    }
    if (
      !Array.isArray(options) ||
      options.length === 0 ||
      !options.every((o) => typeof o === "string" && o.trim())
    ) {
      throw new Error(`Question ${n} needs a non-empty list of options.`);
    }

    const trimmedOptions = options.map((o) => (o as string).trim());
    const trimmedAnswer = typeof answer === "string" ? answer.trim() : "";
    if (!trimmedAnswer || !trimmedOptions.includes(trimmedAnswer)) {
      throw new Error(`Question ${n}'s answer must be one of its options.`);
    }

    return {
      question: question.trim(),
      options: trimmedOptions,
      answer: trimmedAnswer,
    };
  });
}

export function parseTestJson(text: string): Question[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Could not parse JSON — check the file is valid JSON.");
  }
  return validateTestFields(parsed);
}
