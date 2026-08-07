export type BarListItem = {
  key: string;
  label: string;
  value: number;
  displayValue: string;
  color: string;
  sublabel?: string;
};

/** Horizontale balkenlijst, zelfde stijl als de bestaande "Open leads per fase"-balken. */
export function BarList({
  items,
  emptyLabel = "Geen data.",
}: {
  items: BarListItem[];
  emptyLabel?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-400">{emptyLabel}</p>;
  }
  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <div key={item.key} className="flex items-center gap-3">
          <span className="w-40 flex-shrink-0 text-sm text-slate-600">
            {item.label}
            {item.sublabel && (
              <span className="ml-1 text-xs text-slate-400">{item.sublabel}</span>
            )}
          </span>
          <div className="h-3 flex-1 rounded-full bg-slate-100">
            <div
              className="h-3 rounded-full"
              style={{
                width: `${Math.max(4, (item.value / max) * 100)}%`,
                backgroundColor: item.color,
              }}
            />
          </div>
          <span className="w-16 flex-shrink-0 text-right text-sm font-medium text-slate-700">
            {item.displayValue}
          </span>
        </div>
      ))}
    </div>
  );
}
