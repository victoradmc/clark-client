// Fisher-Yates (Durstenfeld) shuffle — returns a new array in randomized
// order, leaving `items` untouched. `random` defaults to `Math.random` but
// is injectable so callers (and tests) can supply a deterministic source.
export function shuffleArray<T>(
  items: T[],
  random: () => number = Math.random,
): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
