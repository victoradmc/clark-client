import { describe, expect, it } from "vitest";
import { shuffleArray } from "./shuffleArray";

describe("shuffleArray", () => {
  it("returns a new array containing exactly the same elements", () => {
    const input = ["a", "b", "c", "d", "e"];
    const result = shuffleArray(input);
    expect([...result].sort()).toEqual([...input].sort());
  });

  it("does not mutate the input array", () => {
    const input = ["a", "b", "c"];
    const copy = [...input];
    shuffleArray(input);
    expect(input).toEqual(copy);
  });

  it("returns a different array instance than the input", () => {
    const input = ["a", "b", "c"];
    expect(shuffleArray(input)).not.toBe(input);
  });

  it("returns an empty array unchanged", () => {
    expect(shuffleArray([])).toEqual([]);
  });

  it("returns a single-element array unchanged", () => {
    expect(shuffleArray(["only"])).toEqual(["only"]);
  });

  it("produces the expected permutation for a deterministic random source", () => {
    // Fisher-Yates with random() always returning 0 always picks index 0 as
    // the swap partner: ['a','b','c','d'] -> swap(3,0) -> ['d','b','c','a']
    // -> swap(2,0) -> ['c','b','d','a'] -> swap(1,0) -> ['b','c','d','a'].
    const result = shuffleArray(["a", "b", "c", "d"], () => 0);
    expect(result).toEqual(["b", "c", "d", "a"]);
  });

  it("never swaps out of bounds when the random source returns near 1", () => {
    // floor(random() * (i+1)) must stay <= i even as random() approaches 1,
    // so this should leave the array unchanged (every swap targets itself).
    const result = shuffleArray(["a", "b", "c", "d"], () => 0.9999999);
    expect(result).toEqual(["a", "b", "c", "d"]);
  });
});
