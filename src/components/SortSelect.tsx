import type { LessonSort } from "../data/clarkApi";

// Shared by the Hub (ticket 02) and My Library (ticket 03) — each screen
// passes its own `options` (My Library adds "recentlyStarred", which only
// makes sense on its own starred-only list) and default value, but the
// control itself and its markup are the one reused piece.
export default function SortSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: LessonSort;
  onChange: (next: LessonSort) => void;
  options: { value: LessonSort; label: string }[];
}) {
  return (
    <>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        className="border-border min-w-[170px] rounded-[11px] border bg-white px-3.5 py-2.5 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value as LessonSort)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </>
  );
}
