import type { CompanyProductionGoalProgress } from "@/lib/actions/production";

const QUARTER_LABELS: Record<number, string> = { 1: "Q1", 2: "Q2", 3: "Q3", 4: "Q4" };

/** Zelfde 3 drempels als percentColor op het dashboard — status-kleuren uit de gevalideerde dataviz-palette (goed/waarschuwing/kritiek), nooit als enige informatiedrager (altijd naast het cijfer zelf). */
function meterColor(percent: number) {
  if (percent >= 100) return "#0ca30c";
  if (percent >= 60) return "#fab219";
  return "#d03b3b";
}

/** Progressiebalk + kwartaaloverzicht voor het bedrijfsbrede productiejaarplan (Beheer > Doelen > Jaarplan) — onderaan het dashboard. */
export function CompanyProductionMeter({
  year,
  progress,
  title,
  unitLabel = "eenheden",
  liveCountLabel,
}: {
  year: number;
  progress: CompanyProductionGoalProgress;
  /** Bv. "Bedrijfsproductie" of "Recrutering" — bepaalt het opschrift boven het grote cijfer. */
  title: string;
  /** Bv. "eenheden" of "medewerkers". */
  unitLabel?: string;
  /** Optionele live-referentie los van het doel, bv. "nu actief: 33 medewerkers" — geen onderdeel van de voortgangsberekening. */
  liveCountLabel?: string;
}) {
  const percent = progress.percent ?? 0;
  const barWidth = Math.min(percent, 100);
  const color = meterColor(percent);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-base text-slate-500 dark:text-slate-400">
            {title} {year}
            {liveCountLabel && (
              <span className="ml-1.5 font-normal text-slate-400 dark:text-slate-500">
                — {liveCountLabel}
              </span>
            )}
          </p>
          <p className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
            {progress.totalActual.toLocaleString("nl-BE")}
            <span className="text-lg font-normal text-slate-400 dark:text-slate-500">
              {" "}
              / {progress.totalTarget.toLocaleString("nl-BE")} {unitLabel}
            </span>
          </p>
        </div>
        <p className="text-3xl font-semibold" style={{ color }}>
          {percent}%
        </p>
      </div>

      <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className="h-full rounded-full"
          style={{ width: `${barWidth}%`, backgroundColor: color }}
        />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {progress.quarters.map((q) => {
          const qPercent =
            q.totalTarget > 0 ? Math.round((q.actualUnits / q.totalTarget) * 100) : null;
          return (
            <div
              key={q.quarter}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-800/60"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {QUARTER_LABELS[q.quarter]}
              </p>
              <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-300">
                {q.actualUnits.toLocaleString("nl-BE")}
                <span className="text-slate-400 dark:text-slate-500">
                  {" "}
                  / {q.totalTarget.toLocaleString("nl-BE")}
                </span>
              </p>
              {qPercent === null ? (
                <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
                  geen doel ingesteld
                </p>
              ) : (
                <p className="text-xs font-medium" style={{ color: meterColor(qPercent) }}>
                  {qPercent}%
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
