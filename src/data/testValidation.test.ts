import { describe, expect, it } from "vitest";
import { parseTestJson, validateTestFields } from "./testValidation";

const VALID_QUESTION = {
  question: "What is 2 + 2?",
  options: ["3", "4", "5"],
  answer: "4",
};

describe("validateTestFields", () => {
  it("accepts a non-empty array of valid Questions", () => {
    expect(validateTestFields([VALID_QUESTION])).toEqual([
      { question: "What is 2 + 2?", options: ["3", "4", "5"], answer: "4" },
    ]);
  });

  it("trims question, option, and answer text", () => {
    expect(
      validateTestFields([
        { question: "  Q  ", options: [" A ", " B "], answer: " A " },
      ]),
    ).toEqual([{ question: "Q", options: ["A", "B"], answer: "A" }]);
  });

  it("rejects a non-array", () => {
    expect(() => validateTestFields({})).toThrowError(
      /non-empty array of questions/,
    );
  });

  it("rejects an empty array", () => {
    expect(() => validateTestFields([])).toThrowError(
      /non-empty array of questions/,
    );
  });

  it("rejects a question missing question text", () => {
    expect(() =>
      validateTestFields([{ options: ["A", "B"], answer: "A" }]),
    ).toThrowError(/Question 1.*question text/);
  });

  it("rejects a question with a blank options list", () => {
    expect(() =>
      validateTestFields([
        { question: "Q", options: [], answer: "A" },
      ]),
    ).toThrowError(/Question 1.*options/);
  });

  it("rejects a question whose answer isn't one of its options", () => {
    expect(() =>
      validateTestFields([
        { question: "Q", options: ["A", "B"], answer: "C" },
      ]),
    ).toThrowError(/Question 1.*answer must be one of its options/);
  });

  it("identifies the specific question index that fails", () => {
    expect(() =>
      validateTestFields([VALID_QUESTION, { question: "Bad" }]),
    ).toThrowError(/Question 2/);
  });
});

describe("parseTestJson", () => {
  it("parses and validates a JSON string", () => {
    expect(parseTestJson(JSON.stringify([VALID_QUESTION]))).toEqual([
      VALID_QUESTION,
    ]);
  });

  it("rejects invalid JSON with a clear message", () => {
    expect(() => parseTestJson("{not valid json")).toThrowError(
      /Could not parse JSON/,
    );
  });
});
