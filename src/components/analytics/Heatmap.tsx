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
  cells: (boolean | null)[];
};

/** Compacte 12-koloms heatmap (per maand), cel groen = gehaald, rood = niet gehaald, leeg = nog geen data. */
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
                    title={
                      cell === null
                        ? "Nog geen data"
                        : cell
                        ? "Gehaald"
                        : "Niet gehaald"
                    }
                    className={`mx-auto flex h-4 w-4 rounded-sm ${
                      cell === null
                        ? "bg-slate-100"
                        : cell
                        ? "bg-green-500"
                        : "bg-red-400"
                    }`}
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
