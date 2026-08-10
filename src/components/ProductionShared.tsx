export function positionBadgeClass(position: number) {
  if (position === 1) return "bg-amber-400 text-amber-950";
  if (position === 2) return "bg-slate-300 text-slate-800";
  if (position === 3) return "bg-orange-400 text-orange-950";
  return "bg-slate-100 text-slate-500";
}

export function percentColor(percent: number | null) {
  if (percent === null) return "text-slate-400";
  if (percent >= 100) return "text-green-600";
  if (percent >= 60) return "text-amber-600";
  return "text-red-600";
}

/** Gekleurde pil-achtergrond voor een percentage — levendiger dan enkel gekleurde tekst, fijn voor export/screenshots. */
export function percentBadgeStyle(percent: number | null): React.CSSProperties {
  if (percent === null) return { background: "#f1f5f9", color: "#64748b" };
  if (percent >= 100) return { background: "#bbf7d0", color: "#166534" };
  if (percent >= 60) return { background: "#fed7aa", color: "#9a3412" };
  return { background: "#fecaca", color: "#991b1b" };
}

export function PercentBadge({ percent }: { percent: number | null }) {
  return (
    <span
      className="inline-flex min-w-14 items-center justify-center rounded-full px-2.5 py-1 text-sm font-semibold"
      style={percentBadgeStyle(percent)}
    >
      {percent === null ? "—" : `${percent}%`}
    </span>
  );
}

export function Position({ position }: { position: number }) {
  return (
    <span
      className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${positionBadgeClass(
        position
      )}`}
    >
      {position}
    </span>
  );
}
