export default function TabToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div role="tablist" className="bg-chip flex gap-0.5 rounded-[11px] p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-lg px-4 py-2 text-[13px] font-semibold ${
            value === option.value ? "bg-white text-ink" : "text-muted"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
