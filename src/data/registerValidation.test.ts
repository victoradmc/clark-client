import { describe, expect, it } from "vitest";
import { MIN_PASSWORD_LENGTH, validateRegisterFields } from "./registerValidation";

describe("validateRegisterFields", () => {
  it("accepts a valid name, email, and password, trimming name and email", () => {
    expect(
      validateRegisterFields({
        name: "  Ada Lovelace  ",
        email: "  ada@clark.test ",
        password: "correct-horse",
      }),
    ).toEqual({
      name: "Ada Lovelace",
      email: "ada@clark.test",
      password: "correct-horse",
    });
  });

  it("does not trim the password", () => {
    expect(
      validateRegisterFields({
        name: "Ada",
        email: "ada@clark.test",
        password: "  spacey pw  ",
      }).password,
    ).toBe("  spacey pw  ");
  });

  it("rejects a missing name with a specific message", () => {
    expect(() =>
      validateRegisterFields({ email: "ada@clark.test", password: "correct-horse" }),
    ).toThrowError(/name/);
  });

  it("rejects a missing email with a specific message", () => {
    expect(() =>
      validateRegisterFields({ name: "Ada", password: "correct-horse" }),
    ).toThrowError(/email/);
  });

  it("rejects a missing password with a specific message", () => {
    expect(() =>
      validateRegisterFields({ name: "Ada", email: "ada@clark.test" }),
    ).toThrowError(/password/);
  });

  it("names every missing field at once", () => {
    expect(() => validateRegisterFields({})).toThrowError(
      /name, email, password/,
    );
  });

  it("rejects a blank name", () => {
    expect(() =>
      validateRegisterFields({
        name: "   ",
        email: "ada@clark.test",
        password: "correct-horse",
      }),
    ).toThrowError(/name/);
  });

  it(`rejects a password shorter than ${MIN_PASSWORD_LENGTH} characters`, () => {
    expect(() =>
      validateRegisterFields({
        name: "Ada",
        email: "ada@clark.test",
        password: "short",
      }),
    ).toThrowError(new RegExp(`${MIN_PASSWORD_LENGTH} characters`));
  });

  it(`accepts a password exactly ${MIN_PASSWORD_LENGTH} characters long`, () => {
    const password = "a".repeat(MIN_PASSWORD_LENGTH);
    expect(
      validateRegisterFields({ name: "Ada", email: "ada@clark.test", password })
        .password,
    ).toBe(password);
  });

  it("rejects non-object input", () => {
    expect(() => validateRegisterFields(null)).toThrow();
    expect(() => validateRegisterFields("just a string")).toThrow();
  });
});
