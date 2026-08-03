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
