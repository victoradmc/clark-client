export type ParsedLessonFields = {
  title: string;
  content: string;
  subject: string;
  origin: string;
};

// Shared by the Upload Lesson screen (pre-network validation on parse) and
// clarkApi.createLesson (the seam itself re-validates — see ticket 02's
// integration-test requirement) so there is exactly one rule set.
export function validateLessonFields(input: unknown): ParsedLessonFields {
  if (typeof input !== "object" || input === null) {
    throw new Error(
      "Expected a JSON object with title, content, and subject.",
    );
  }

  const { title, content, subject, origin } = input as Record<
    string,
    unknown
  >;

  const missing: string[] = [];
  if (typeof title !== "string" || !title.trim()) missing.push("title");
  if (typeof content !== "string" || !content.trim()) missing.push("content");
  if (typeof subject !== "string" || !subject.trim()) missing.push("subject");
  if (missing.length > 0) {
    throw new Error(
      `Missing required field${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`,
    );
  }

  return {
    title: (title as string).trim(),
    content: content as string,
    subject: (subject as string).trim(),
    origin:
      typeof origin === "string" && origin.trim() ? origin.trim() : "Unknown",
  };
}

export function parseLessonJson(text: string): ParsedLessonFields {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Could not parse JSON — check the file is valid JSON.");
  }
  return validateLessonFields(parsed);
}
