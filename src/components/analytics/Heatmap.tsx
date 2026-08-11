const MONTH_SHORT = [
  "jan",
  "feb",
  "mrt",
  "apr",
  "mei",
  "jun",
  "jul",
  "aug",
  "sep",
  "okt",
  "nov",
  "dec",
];

export type HeatmapRow = {
  key: string;
  label: string;
  /** Index 0 = januari t.e.m. index 11 = december. `null` = nog geen data/te vroeg. */
  cells: (number | null)[];
};

function cellColor(percent: number | null) {
  if (percent === null) return "bg-slate-100";
  if (percent >= 100) return "bg-green-500";
  if (percent >= 75) return "bg-orange-400";
  return "bg-red-400";
}

/** Compacte 12-koloms heatmap (per maand): rood <75%, oranje 75-99%, groen 100%+, leeg = nog geen data. */
export function Heatmap({ rows }: { rows: HeatmapRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-400">Geen gebruikers gevonden.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-slate-500">
            <th className="py-1.5 pr-3 font-medium">Naam</th>
            {MONTH_SHORT.map((m) => (
              <th key={m} className="px-1 py-1.5 text-center font-medium">
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-slate-100">
              <td className="whitespace-nowrap py-1.5 pr-3 font-medium text-slate-900">
                {row.label}
              </td>
              {row.cells.map((cell, i) => (
                <td key={i} className="px-1 py-1.5 text-center">
                  <span
                    title={cell === null ? "Nog geen data" : `${cell}%`}
                    className={`mx-auto flex h-4 w-4 rounded-sm ${cellColor(cell)}`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
