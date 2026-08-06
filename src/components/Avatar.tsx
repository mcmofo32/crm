const PALETTE = [
  "bg-rose-100 text-rose-700",
  "bg-orange-100 text-orange-700",
  "bg-amber-100 text-amber-700",
  "bg-lime-100 text-lime-700",
  "bg-emerald-100 text-emerald-700",
  "bg-teal-100 text-teal-700",
  "bg-cyan-100 text-cyan-700",
  "bg-blue-100 text-blue-700",
  "bg-indigo-100 text-indigo-700",
  "bg-violet-100 text-violet-700",
  "bg-fuchsia-100 text-fuchsia-700",
  "bg-pink-100 text-pink-700",
];

function colorForName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

function initials(name: string) {
  const letters = name.match(/\p{L}[\p{L}'-]*/gu) ?? [];
  const first = letters[0];
  if (!first) return "?";
  if (letters.length === 1) return first.slice(0, 2).toUpperCase();
  const last = letters[letters.length - 1] ?? first;
  return (first[0] + last[0]).toUpperCase();
}

export function Avatar({
  name,
  size = "sm",
  photoUrl,
}: {
  name: string;
  size?: "sm" | "md";
  /** URL naar de geüploade profielfoto van deze gebruiker, indien aanwezig. */
  photoUrl?: string | null;
}) {
  const sizeClasses = size === "md" ? "h-9 w-9 text-sm" : "h-7 w-7 text-xs";

  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={name}
        title={name}
        className={`inline-block flex-shrink-0 rounded-full object-cover ${sizeClasses}`}
      />
    );
  }

  return (
    <span
      title={name}
      className={`inline-flex flex-shrink-0 items-center justify-center rounded-full font-semibold ${sizeClasses} ${colorForName(
        name
      )}`}
    >
      {initials(name)}
    </span>
  );
}
