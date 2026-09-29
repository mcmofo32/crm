import type { CSSProperties } from "react";
import type { CompanyProductionContributions } from "@/lib/actions/production";

/** Gevalideerde categorische palette (dataviz-skill) — vaste volgorde, nooit gecycled. */
const SLOT_COLORS: { light: string; dark: string }[] = [
  { light: "#2a78d6", dark: "#3987e5" },
  { light: "#eb6834", dark: "#d95926" },
  { light: "#1baf7a", dark: "#199e70" },
  { light: "#eda100", dark: "#c98500" },
  { light: "#e87ba4", dark: "#d55181" },
  { light: "#008300", dark: "#008300" },
  { light: "#4a3aa7", dark: "#9085e9" },
];
/** Neutraal, geen categorische hue — "Overige" is een verzameling, geen eigen identiteit. */
const OTHER_COLOR = { light: "#898781", dark: "#898781" };
const MAX_SLICES = 7;
const GAP_PCT = 0.6;

type Slice = {
  key: string;
  name: string;
  units: number;
  percent: number;
  color: { light: string; dark: string };
};

function colorVars(color: { light: string; dark: string }): CSSProperties {
  return { "--slice-light": color.light, "--slice-dark": color.dark } as CSSProperties;
}

/** Taartdiagram (donut) van de gerealiseerde bedrijfsproductie per medewerker — onderaan het dashboard, naast CompanyProductionMeter. */
export function CompanyProductionPieChart({
  contributions,
}: {
  contributions: CompanyProductionContributions;
}) {
  if (contributions.rows.length === 0 || contributions.total <= 0) return null;

  const top = contributions.rows.slice(0, MAX_SLICES);
  const rest = contributions.rows.slice(MAX_SLICES);
  const restUnits = rest.reduce((sum, r) => sum + r.units, 0);

  // De taart zelf blijft beperkt tot MAX_SLICES + "Overige" (zie SLOT_COLORS
  // hierboven: bewust een vaste, nooit-gecyclede kleurenset) — meer dan een
  // stuk of 7 dunne taartpunten is toch niet meer van elkaar te
  // onderscheiden. Het leaderboard ernaast toont wél iedereen apart.
  const chartSlices: Slice[] = [
    ...top.map((r, i) => ({
      key: r.userId,
      name: r.name,
      units: r.units,
      percent: r.percent,
      color: SLOT_COLORS[i],
    })),
    ...(rest.length > 0
      ? [
          {
            key: "__other__",
            name: `Overige (${rest.length})`,
            units: restUnits,
            percent:
              contributions.total > 0
                ? Math.round((restUnits / contributions.total) * 1000) / 10
                : 0,
            color: OTHER_COLOR,
          },
        ]
      : []),
  ];

  const cx = 100;
  const cy = 100;
  const r = 70;
  const strokeWidth = 34;

  let cumulative = 0;
  const arcs = chartSlices.map((slice) => {
    const dash = Math.max(slice.percent - GAP_PCT, 0);
    const offset = -cumulative;
    cumulative += slice.percent;
    return { ...slice, dash, offset };
  });

  // Leaderboard: elke medewerker met productie staat er apart op, ook wie
  // niet meer als eigen taartpunt past — wie in de taart nog onder "Overige"
  // valt, krijgt hier dezelfde neutrale kleur (geen eigen taartpunt, dus ook
  // geen eigen categorische kleur), maar wel zijn eigen rang, naam en cijfer.
  const leaderboardRows: Slice[] = contributions.rows.map((r, i) => ({
    key: r.userId,
    name: r.name,
    units: r.units,
    percent: r.percent,
    color: i < MAX_SLICES ? SLOT_COLORS[i] : OTHER_COLOR,
  }));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <p className="mb-4 text-base text-slate-500 dark:text-slate-400">
        Verdeling gerealiseerde productie per medewerker
      </p>
      <div className="flex flex-col items-center gap-6 sm:flex-row">
        <svg viewBox="0 0 200 200" className="h-48 w-48 flex-shrink-0">
          {arcs.map((slice) => (
            <circle
              key={slice.key}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              strokeWidth={strokeWidth}
              pathLength={100}
              strokeDasharray={`${slice.dash} ${100 - slice.dash}`}
              strokeDashoffset={slice.offset}
              transform={`rotate(-90 ${cx} ${cy})`}
              className="stroke-[var(--slice-light)] dark:stroke-[var(--slice-dark)]"
              style={colorVars(slice.color)}
            >
              <title>
                {slice.name}: {slice.units.toLocaleString("nl-BE")} eenheden ({slice.percent}%)
              </title>
            </circle>
          ))}
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            fontSize="22"
            className="fill-slate-900 font-semibold dark:fill-slate-100"
          >
            {contributions.total.toLocaleString("nl-BE")}
          </text>
          <text
            x={cx}
            y={cy + 16}
            textAnchor="middle"
            fontSize="12"
            className="fill-slate-400 dark:fill-slate-500"
          >
            eenheden
          </text>
        </svg>

        <ul className="flex max-h-72 w-full flex-col gap-2 overflow-y-auto pr-1">
          {leaderboardRows.map((row, i) => (
            <li
              key={row.key}
              className="flex items-center justify-between gap-3 text-sm text-slate-700 dark:text-slate-300"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-5 flex-shrink-0 text-right text-xs tabular-nums text-slate-400 dark:text-slate-500">
                  {i + 1}
                </span>
                <span
                  className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-[var(--slice-light)] dark:bg-[var(--slice-dark)]"
                  style={colorVars(row.color)}
                />
                <span className="truncate">{row.name}</span>
              </span>
              <span className="flex-shrink-0 text-slate-500 dark:text-slate-400">
                {row.units.toLocaleString("nl-BE")}{" "}
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {row.percent}%
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
