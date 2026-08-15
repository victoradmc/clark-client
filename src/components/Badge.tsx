export default function Badge({
  children,
  tone = "neutral",
}: {
  children: string;
  tone?: "brand" | "neutral";
}) {
  const toneClass =
    tone === "brand"
      ? "bg-brand-tint text-brand-dark font-bold"
      : "bg-chip text-chip-text font-semibold";
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11.5px] ${toneClass}`}
    >
      {children}
    </span>
  );
}
