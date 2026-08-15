import { describe, expect, it } from "vitest";
import { parseLessonJson, validateLessonFields } from "./lessonValidation";

describe("validateLessonFields", () => {
  it("accepts an object with title, content, and subject", () => {
    expect(
      validateLessonFields({
        title: "Newton's Laws",
        content: "## First Law\nAn object stays at rest...",
        subject: "Physics",
      }),
    ).toEqual({
      title: "Newton's Laws",
      content: "## First Law\nAn object stays at rest...",
      subject: "Physics",
      origin: "Unknown",
    });
  });

  it("keeps a provided origin", () => {
    expect(
      validateLessonFields({
        title: "T",
        content: "C",
        subject: "S",
        origin: "Video: lecture.mp4",
      }).origin,
    ).toBe("Video: lecture.mp4");
  });

  it("defaults origin to Unknown when omitted", () => {
    expect(
      validateLessonFields({ title: "T", content: "C", subject: "S" }).origin,
    ).toBe("Unknown");
  });

  it("defaults origin to Unknown when blank", () => {
    expect(
      validateLessonFields({
        title: "T",
        content: "C",
        subject: "S",
        origin: "   ",
      }).origin,
    ).toBe("Unknown");
  });

  it("rejects a missing title with a specific message", () => {
    expect(() =>
      validateLessonFields({ content: "C", subject: "S" }),
    ).toThrowError(/title/);
  });

  it("rejects a missing content with a specific message", () => {
    expect(() =>
      validateLessonFields({ title: "T", subject: "S" }),
    ).toThrowError(/content/);
  });

  it("rejects a missing subject with a specific message", () => {
    expect(() =>
      validateLessonFields({ title: "T", content: "C" }),
    ).toThrowError(/subject/);
  });

  it("names every missing field at once", () => {
    expect(() => validateLessonFields({})).toThrowError(
      /title, content, subject/,
    );
  });

  it("rejects a blank title", () => {
    expect(() =>
      validateLessonFields({ title: "   ", content: "C", subject: "S" }),
    ).toThrowError(/title/);
  });

  it("rejects non-object input", () => {
    expect(() => validateLessonFields(null)).toThrow();
    expect(() => validateLessonFields("just a string")).toThrow();
  });
});

describe("parseLessonJson", () => {
  it("parses and validates a JSON string", () => {
    const result = parseLessonJson(
      '{"title":"T","content":"C","subject":"S"}',
    );
    expect(result.title).toBe("T");
  });

  it("rejects invalid JSON with a clear message", () => {
    expect(() => parseLessonJson("{not valid json")).toThrowError(
      /Could not parse JSON/,
    );
  });

  it("rejects valid JSON missing required fields", () => {
    expect(() => parseLessonJson('{"title":"T"}')).toThrowError(
      /content, subject/,
    );
  });
});
