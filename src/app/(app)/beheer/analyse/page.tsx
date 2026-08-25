import { redirect } from "next/navigation";
import Link from "next/link";
import { BarChart3, ChevronLeft, ChevronRight } from "lucide-react";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canViewBeheerderTools } from "@/lib/permissions";
import {
  getAnalytics,
  getFunnelDropoff,
  getStageDurations,
  getLeadTrend,
  getSeasonalPattern,
  getCustomerValueStats,
  getRevenueByProductionMonth,
  getActivityQualityStats,
  getCustomerGrowthCurve,
  getTaxStatusBreakdown,
  getIncentiveOverview,
  getKpiHeatmap,
  getKpiHeatmapWeekly,
  getEventAttendanceStats,
  type SeasonalBucket,
  type KpiHeatmapRow,
  type KpiHeatmapWeekRow,
} from "@/lib/actions/analytics";
import { getAssignableUsers } from "@/lib/actions/leads";
import {
  LEAD_TYPE_LABELS,
  ROLE_LABELS,
  ROLE_BADGE_VARIANT,
  conversionBadgeVariant,
} from "@/lib/roleLabels";
import { KPI_METRIC_LABELS } from "@/lib/goalLabels";
import { isoWeeksOfYear } from "@/lib/productionMonth";
import { Badge } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";
import { LineChart } from "@/components/analytics/LineChart";
import { BarList, type BarListItem } from "@/components/analytics/BarList";
import { Heatmap, MONTH_HEATMAP_COLUMNS, type HeatmapColumn } from "@/components/analytics/Heatmap";

const STAGE_COLORS = ["#2563eb", "#4f46e5", "#7c3aed", "#a21caf", "#c026d3"];
// Categorische kleuren gevalideerd met de dataviz-skill (validate_palette.js):
// CVD-scheiding en normaal-zicht-contrast getest per combinatie die samen in
// één grafiek voorkomt — zie sessie-notities voor de exacte ΔE-waarden.
const LEAD_TYPE_COLOR = { FA: "#2563eb", RG: "#d97706" } as const;
const COLOR_NEW = "#2563eb";
const COLOR_WON = "#059669";
const COLOR_LOST = "#dc2626";
const COLOR_AMBER = "#d97706";
const COLOR_TAX_TODO = "#e11d48";
const COLOR_PURPLE = "#7e22ce";

const SEASON_METRICS = [
  { key: "won", label: "Klanten" },
  { key: "financieleAnalyses", label: "Financiële analyses" },
  { key: "adviesgesprekken", label: "Adviesgesprekken" },
] as const;

function formatAmount(amount: number) {
  return amount.toLocaleString("nl-BE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function Section({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-slate-900">{title}</h2>
          {hint && <p className="mt-0.5 text-sm text-slate-500">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function momDelta(current: number, previous: number) {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  const positive = delta > 0;
  const flat = delta === 0;
  return (
    <span
      className={`ml-2 text-xs font-medium ${
        flat ? "text-slate-400" : positive ? "text-green-600" : "text-red-600"
      }`}
    >
      {flat ? "±0%" : `${positive ? "+" : ""}${delta}% t.o.v. vorige maand`}
    </span>
  );
}

export default async function AnalysePage({
  searchParams,
}: {
  searchParams: Promise<{
    team?: string;
    person?: string;
    trendType?: string;
    trendMonths?: string;
    year?: string;
    seasonMetric?: string;
    kpiView?: string;
  }>;
}) {
  const viewer = await getEffectiveViewer();
  if (!viewer) redirect("/login");
  if (!canViewBeheerderTools(viewer)) redirect("/dashboard");

  const {
    team: teamFilter,
    person: personFilter,
    trendType: trendTypeRaw,
    trendMonths: trendMonthsRaw,
    year: yearRaw,
    seasonMetric: seasonMetricRaw,
    kpiView: kpiViewRaw,
  } = await searchParams;

  const trendType = trendTypeRaw === "FA" || trendTypeRaw === "RG" ? trendTypeRaw : null;
  const trendMonths = [6, 12, 24].includes(Number(trendMonthsRaw))
    ? Number(trendMonthsRaw)
    : 12;
  const year = yearRaw && /^\d{4}$/.test(yearRaw) ? Number(yearRaw) : new Date().getFullYear();
  const seasonMetric = SEASON_METRICS.some((m) => m.key === seasonMetricRaw)
    ? seasonMetricRaw!
    : "won";
  const kpiView = kpiViewRaw === "week" ? "week" : "month";

  const [
    { byType, stageDistribution, perEmployee, teams },
    allEmployees,
    funnelDropoff,
    stageDurations,
    leadTrend,
    seasonalPattern,
    customerValueStats,
    revenueByMonth,
    activityQuality,
    customerGrowth,
    taxStatusBreakdown,
    incentiveOverview,
    kpiHeatmapRaw,
    eventAttendance,
  ] = await Promise.all([
    getAnalytics(teamFilter, personFilter),
    getAssignableUsers({ includeInactive: true }),
    getFunnelDropoff(),
    getStageDurations(),
    getLeadTrend(trendType, trendMonths),
    getSeasonalPattern(trendType),
    getCustomerValueStats(),
    getRevenueByProductionMonth(year),
    getActivityQualityStats(),
    getCustomerGrowthCurve(trendMonths),
    getTaxStatusBreakdown(),
    getIncentiveOverview(),
    kpiView === "week" ? getKpiHeatmapWeekly(year) : getKpiHeatmap(year),
    getEventAttendanceStats(),
  ]);

  const maxStageCount = Math.max(1, ...stageDistribution.map((s) => s.count));

  function trendHref(overrides: { trendType?: string; trendMonths?: string }) {
    const params = new URLSearchParams();
    const nextType = overrides.trendType ?? trendType ?? "";
    const nextMonths = overrides.trendMonths ?? String(trendMonths);
    if (nextType) params.set("trendType", nextType);
    if (nextMonths) params.set("trendMonths", nextMonths);
    const qs = params.toString();
    return qs ? `/beheer/analyse?${qs}#trends` : "/beheer/analyse#trends";
  }

  function seasonHref(metric: string) {
    const params = new URLSearchParams();
    if (trendType) params.set("trendType", trendType);
    if (metric !== "won") params.set("seasonMetric", metric);
    const qs = params.toString();
    return qs ? `/beheer/analyse?${qs}#seizoen` : "/beheer/analyse#seizoen";
  }

  const seasonMax = Math.max(
    1,
    ...seasonalPattern.map((s) => s[seasonMetric as keyof SeasonalBucket] as number)
  );

  const heatmapMetrics = ["PRODUCTION", "CONVERSATIONS", "CALLING_SESSION", "SEMINAR"] as const;

  function formatWeekRange(start: Date, end: Date) {
    const last = new Date(end.getTime() - 1);
    const fmt = (d: Date) => d.toLocaleDateString("nl-BE", { day: "numeric", month: "short" });
    return `${fmt(start)} – ${fmt(last)}`;
  }

  const kpiColumns: HeatmapColumn[] =
    kpiView === "week"
      ? isoWeeksOfYear(year).map((w) => ({
          key: String(w.weekIndex),
          label: String(w.weekIndex + 1),
          title: `Week ${w.weekIndex + 1}: ${formatWeekRange(w.start, w.end)}`,
        }))
      : MONTH_HEATMAP_COLUMNS;

  // Beide weergaves (per maand/per week) genormaliseerd naar dezelfde vorm
  // (percent-cellen per metric, in kolomvolgorde), zodat de JSX hieronder
  // niet zelf met de 2 verschillende brontypes moet omgaan.
  const kpiHeatmapRows = (kpiHeatmapRaw as (KpiHeatmapRow | KpiHeatmapWeekRow)[]).map((row) => {
    const cellsByMetric = new Map<string, (number | null)[]>();
    for (const metric of heatmapMetrics) {
      const cells =
        kpiView === "week"
          ? (row as KpiHeatmapWeekRow).cells
              .filter((c) => c.metric === metric)
              .sort((a, b) => a.weekIndex - b.weekIndex)
              .map((c) => c.percent)
          : (row as KpiHeatmapRow).cells
              .filter((c) => c.metric === metric)
              .sort((a, b) => a.month - b.month)
              .map((c) => c.percent);
      cellsByMetric.set(metric, cells);
    }
    return { userId: row.userId, name: row.name, cellsByMetric };
  });

  function kpiHref(overrides: { year?: number; kpiView?: "month" | "week" }) {
    const params = new URLSearchParams();
    params.set("year", String(overrides.year ?? year));
    const view = overrides.kpiView ?? kpiView;
    if (view !== "month") params.set("kpiView", view);
    return `/beheer/analyse?${params.toString()}#kpi`;
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900">
          <BarChart3 size={26} />
          Analyse
        </h1>
        <p className="mt-1 text-base text-slate-500">
          Conversie en prestaties. Enkel zichtbaar voor de Beheerder.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2 text-sm">
            <Link
              href="/beheer/analyse"
              className={`rounded-full px-3 py-1.5 ${
                !personFilter && (!teamFilter || teamFilter === "alle")
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600"
              }`}
            >
              Alle teams
            </Link>
            {teams.map((team) => (
              <Link
                key={team.id}
                href={`/beheer/analyse?team=${team.id}`}
                className={`rounded-full px-3 py-1.5 ${
                  !personFilter && teamFilter === team.id
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-600"
                }`}
              >
                {team.name}
              </Link>
            ))}
            <Link
              href="/beheer/analyse?team=geen"
              className={`rounded-full px-3 py-1.5 ${
                !personFilter && teamFilter === "geen"
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600"
              }`}
            >
              Zonder team
            </Link>
          </div>
          <form method="GET" className="flex flex-wrap items-center gap-2 text-sm">
            <select
              name="person"
              defaultValue={personFilter ?? ""}
              className="rounded-md border border-slate-300 px-3 py-1.5"
            >
              <option value="">Alle medewerkers</option>
              {allEmployees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-800"
            >
              Bekijken
            </button>
          </form>
        </div>
        <p className="text-xs text-slate-400">
          Filtert alle cijfers hieronder tot dit team of deze medewerker
          (persoon overschrijft team).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {(["FA", "RG"] as const).map((type) => {
          const stats = byType[type];
          return (
            <div
              key={type}
              className="rounded-xl border border-slate-200 bg-white p-6"
            >
              <h2 className="mb-4 text-lg font-medium text-slate-900">
                {LEAD_TYPE_LABELS[type]}
              </h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatTile label="Totaal" value={String(stats.total)} />
                <StatTile label="Open" value={String(stats.open)} />
                <StatTile label="Gewonnen" value={String(stats.won)} />
                <StatTile label="Verloren" value={String(stats.lost)} />
              </div>
              <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4">
                <span className="text-sm text-slate-500">Conversieratio</span>
                <Badge variant={conversionBadgeVariant(stats.conversionRate)}>
                  {stats.conversionRate === null
                    ? "Nog geen beslissing"
                    : `${stats.conversionRate}%`}
                </Badge>
                <span className="text-xs text-slate-400">
                  (gewonnen / gewonnen+verloren)
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <Section title="Open leads per fase" hint="Waar leads momenteel blijven hangen, per funnel.">
        <div className="flex flex-col gap-3">
          {stageDistribution.map((bucket, i) => (
            <div
              key={`${bucket.leadType}:${bucket.label}`}
              className="flex items-center gap-3"
            >
              <span className="w-40 flex-shrink-0 text-sm text-slate-600">
                {bucket.label}
              </span>
              <div className="h-3 flex-1 rounded-full bg-slate-100">
                <div
                  className="h-3 rounded-full"
                  style={{
                    width: `${Math.max(4, (bucket.count / maxStageCount) * 100)}%`,
                    backgroundColor: STAGE_COLORS[i % STAGE_COLORS.length],
                  }}
                />
              </div>
              <span className="w-8 flex-shrink-0 text-right text-sm font-medium text-slate-700">
                {bucket.count}
              </span>
            </div>
          ))}
          {stageDistribution.length === 0 && (
            <p className="text-sm text-slate-400">Geen open leads.</p>
          )}
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section
          title="Drop-off per fase"
          hint="Hoeveel leads elke fase van de funnel ooit bereikt hebben, en het percentage dat afvalt t.o.v. de vorige fase."
        >
          {(["FA", "RG"] as const).map((type) => {
            const items: BarListItem[] = funnelDropoff
              .filter((s) => s.leadType === type)
              .map((s) => ({
                key: s.key,
                label: s.label,
                value: s.reached,
                displayValue:
                  s.dropoffPercent === null ? String(s.reached) : `${s.reached} (-${s.dropoffPercent}%)`,
                color: LEAD_TYPE_COLOR[type],
              }));
            return (
              <div key={type} className="mb-4 last:mb-0">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                  {LEAD_TYPE_LABELS[type]}
                </p>
                <BarList items={items} />
              </div>
            );
          })}
        </Section>

        <Section
          title="Gemiddelde doorlooptijd per fase"
          hint="Gemiddeld aantal dagen tussen twee fase-wissels, per fase van de hoofd-funnel."
        >
          {(["FA", "RG"] as const).map((type) => {
            const items: BarListItem[] = stageDurations
              .filter((s) => s.leadType === type)
              .map((s) => ({
                key: s.key,
                label: s.label,
                value: s.avgDays ?? 0,
                displayValue:
                  s.avgDays === null ? "—" : `${s.avgDays}d`,
                sublabel: s.sampleSize > 0 ? `(${s.sampleSize})` : undefined,
                color: LEAD_TYPE_COLOR[type],
              }));
            return (
              <div key={type} className="mb-4 last:mb-0">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                  {LEAD_TYPE_LABELS[type]}
                </p>
                <BarList items={items} />
              </div>
            );
          })}
        </Section>
      </div>

      <div id="trends" className="scroll-mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium text-slate-900">Trend over tijd</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Nieuwe, gewonnen en verloren leads per maand.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <div className="flex gap-1">
              {(["alle", "FA", "RG"] as const).map((t) => (
                <Link
                  key={t}
                  href={trendHref({ trendType: t === "alle" ? "" : t })}
                  className={`rounded-full px-3 py-1.5 ${
                    (t === "alle" && !trendType) || trendType === t
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {t === "alle" ? "Alle" : LEAD_TYPE_LABELS[t]}
                </Link>
              ))}
            </div>
            <div className="flex gap-1">
              {[6, 12, 24].map((m) => (
                <Link
                  key={m}
                  href={trendHref({ trendMonths: String(m) })}
                  className={`rounded-full px-3 py-1.5 ${
                    trendMonths === m
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {m}m
                </Link>
              ))}
            </div>
          </div>
        </div>

        <LineChart
          labels={leadTrend.map((p) => p.label)}
          series={[
            { key: "new", label: "Nieuw", color: COLOR_NEW, values: leadTrend.map((p) => p.newLeads) },
            { key: "won", label: "Gewonnen", color: COLOR_WON, values: leadTrend.map((p) => p.won) },
            { key: "lost", label: "Verloren", color: COLOR_LOST, values: leadTrend.map((p) => p.lost) },
          ]}
        />

        {leadTrend.length >= 2 && (
          <p className="mt-3 text-sm text-slate-500">
            Nieuwe leads deze maand: {leadTrend[leadTrend.length - 1].newLeads}
            <DeltaBadge
              delta={momDelta(
                leadTrend[leadTrend.length - 1].newLeads,
                leadTrend[leadTrend.length - 2].newLeads
              )}
            />
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section
          title="Klantengroei"
          hint={`Cumulatief aantal klanten over de laatste ${trendMonths} maanden.`}
        >
          <LineChart
            labels={customerGrowth.map((p) => p.label)}
            series={[
              {
                key: "cumulative",
                label: "Klanten",
                color: COLOR_WON,
                values: customerGrowth.map((p) => p.cumulative),
              },
            ]}
          />
        </Section>

        <Section
          title="Seizoenspatroon"
          hint="Per kalendermaand, opgeteld over alle jaren — toont piekmaanden."
          action={
            <div id="seizoen" className="scroll-mt-6 flex flex-wrap gap-1 text-sm">
              {SEASON_METRICS.map((m) => (
                <Link
                  key={m.key}
                  href={seasonHref(m.key)}
                  className={`rounded-full px-3 py-1.5 ${
                    seasonMetric === m.key
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {m.label}
                </Link>
              ))}
            </div>
          }
        >
          <BarList
            items={seasonalPattern.map((s) => ({
              key: String(s.month),
              label: s.label,
              value: s[seasonMetric as keyof SeasonalBucket] as number,
              displayValue: String(s[seasonMetric as keyof SeasonalBucket]),
              color: STAGE_COLORS[(s.month - 1) % STAGE_COLORS.length],
            }))}
          />
          {seasonMax <= 1 && (
            <p className="mt-2 text-xs text-slate-400">Nog te weinig data voor een duidelijk patroon.</p>
          )}
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Section title="Cross-sell & klantwaarde">
          <div className="grid grid-cols-1 gap-4">
            <StatTile
              label="Cross-sell"
              value={
                customerValueStats.crossSellPercent === null
                  ? "—"
                  : `${customerValueStats.crossSellPercent}%`
              }
              hint="Klanten met meer dan 1 producttype"
            />
            <StatTile
              label="Gem. bedrag per klant"
              value={formatAmount(customerValueStats.avgAmountPerCustomer)}
            />
            <StatTile
              label="Gem. eenheden per klant"
              value={String(customerValueStats.avgUnitsPerCustomer)}
            />
          </div>
        </Section>

        <Section title="Opvolgkwaliteit">
          <div className="grid grid-cols-1 gap-4">
            <StatTile
              label="No-show-ratio"
              value={
                activityQuality.noShowRatio === null ? "—" : `${activityQuality.noShowRatio}%`
              }
              hint="Niet opgedaagd / (afgerond + niet opgedaagd)"
            />
            <StatTile
              label="Voicemail-ratio"
              value={
                activityQuality.voicemailRatio === null
                  ? "—"
                  : `${activityQuality.voicemailRatio}%`
              }
              hint="Van alle afgeronde telefoongesprekken"
            />
            <StatTile
              label="Contactpogingen vóór klant"
              value={
                activityQuality.avgContactAttemptsBeforeWon === null
                  ? "—"
                  : String(activityQuality.avgContactAttemptsBeforeWon)
              }
              hint="Gemiddeld aantal afgeronde contacten"
            />
          </div>
        </Section>

        <Section title="Belastingsaangifte">
          <BarList
            items={taxStatusBreakdown.map((t) => ({
              key: t.status,
              label: t.label,
              value: t.count,
              displayValue: `${t.count} (${t.percent}%)`,
              color:
                t.status === "DONE"
                  ? COLOR_WON
                  : t.status === "SCHEDULED"
                  ? COLOR_AMBER
                  : t.status === "NVT"
                  ? "#94a3b8"
                  : t.status === "BOEKHOUDER"
                  ? COLOR_PURPLE
                  : COLOR_TAX_TODO,
            }))}
          />
        </Section>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium text-slate-900">Omzet per productiemaand</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Omzet van nieuwe klanten per productiemaand van {year}.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Link
              href={`/beheer/analyse?year=${year - 1}#omzet`}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
            >
              <ChevronLeft size={15} />
            </Link>
            <span className="font-medium text-slate-900">{year}</span>
            <Link
              href={`/beheer/analyse?year=${year + 1}#omzet`}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
            >
              <ChevronRight size={15} />
            </Link>
          </div>
        </div>
        <LineChart
          labels={revenueByMonth.map((m) => m.label)}
          series={[
            {
              key: "revenue",
              label: "Omzet",
              color: COLOR_WON,
              values: revenueByMonth.map((m) => Math.round(m.revenue)),
            },
          ]}
        />
        <p className="mt-2 text-xs text-slate-400">
          Totaal {year}: {formatAmount(revenueByMonth.reduce((s, m) => s + m.revenue, 0))} ·{" "}
          {revenueByMonth.reduce((s, m) => s + m.units, 0)} eenheden
        </p>
      </div>

      <Section
        title="Incentives — voortgang"
        hint="Lopende en recent afgelopen incentives, met top 3 en aantal dat de vereisten haalt."
      >
        {incentiveOverview.length === 0 ? (
          <p className="text-sm text-slate-400">Geen (recente) incentives.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {incentiveOverview.map((incentive) => (
              <div
                key={incentive.incentiveId}
                className="rounded-lg border border-slate-100 p-4"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/incentives/${incentive.incentiveId}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {incentive.title}
                    </Link>
                    <Badge variant={incentive.isActive ? "green" : "slate"}>
                      {incentive.isActive ? "Lopend" : "Afgelopen"}
                    </Badge>
                  </div>
                  <span className="text-sm text-slate-500">
                    {incentive.achievedCount}/{incentive.totalParticipants} halen de vereisten
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  {incentive.topEntries.map((entry, i) => (
                    <div
                      key={entry.userId}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="flex items-center gap-2 text-slate-700">
                        <span className="w-4 text-xs text-slate-400">#{i + 1}</span>
                        {entry.name}
                      </span>
                      <span className="text-slate-500">{entry.progressPercent}%</span>
                    </div>
                  ))}
                  {incentive.topEntries.length === 0 && (
                    <p className="text-sm text-slate-400">Nog geen deelnemers met score.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="KPI-heatmap per medewerker"
        hint={`Rood <75%, oranje 75-99%, groen 100%+, leeg = nog geen data — per ${
          kpiView === "week" ? "week" : "maand"
        } van ${year}.`}
        action={
          <div className="flex items-center gap-2 text-sm">
            <div className="flex gap-1">
              {(["month", "week"] as const).map((v) => (
                <Link
                  key={v}
                  href={kpiHref({ kpiView: v })}
                  className={`rounded-full px-3 py-1.5 ${
                    kpiView === v
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {v === "month" ? "Maand" : "Week"}
                </Link>
              ))}
            </div>
            <Link
              href={kpiHref({ year: year - 1 })}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
            >
              <ChevronLeft size={15} />
            </Link>
            <span className="font-medium text-slate-900">{year}</span>
            <Link
              href={kpiHref({ year: year + 1 })}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
            >
              <ChevronRight size={15} />
            </Link>
          </div>
        }
      >
        <div id="kpi" className="scroll-mt-6 flex flex-col gap-6">
          {heatmapMetrics.map((metric) => (
            <div key={metric}>
              <p className="mb-2 text-sm font-medium text-slate-700">
                {KPI_METRIC_LABELS[metric]}
              </p>
              <Heatmap
                columns={kpiColumns}
                rows={kpiHeatmapRows.map((row) => ({
                  key: row.userId,
                  label: row.name,
                  cells: row.cellsByMetric.get(metric) ?? [],
                }))}
              />
            </div>
          ))}
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="Aanwezigheidsratio per evenement-type">
          <BarList
            items={eventAttendance.byEventType.map((e) => ({
              key: e.type,
              label: e.label,
              value: e.ratio ?? 0,
              displayValue: e.ratio === null ? "—" : `${e.ratio}%`,
              sublabel: `(${e.totalGoing}/${e.totalVerified})`,
              color: COLOR_WON,
            }))}
          />
        </Section>

        <Section title="Aanwezigheidsratio per medewerker">
          <BarList
            items={eventAttendance.byEmployee.slice(0, 10).map((e) => ({
              key: e.userId,
              label: e.name,
              value: e.ratio ?? 0,
              displayValue: e.ratio === null ? "—" : `${e.ratio}%`,
              sublabel: `(${e.totalGoing}/${e.totalVerified})`,
              color: COLOR_WON,
            }))}
            emptyLabel="Nog geen bevestigde aanwezigheden."
          />
        </Section>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-6 pb-4">
          <h2 className="text-lg font-medium text-slate-900">
            Overzicht per medewerker
          </h2>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-base">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-6 py-3 font-medium">Naam</th>
              <th className="px-6 py-3 font-medium">Rol</th>
              <th className="px-6 py-3 font-medium">Team</th>
              <th className="px-6 py-3 font-medium">Leads</th>
              <th className="px-6 py-3 font-medium">Gewonnen</th>
              <th className="px-6 py-3 font-medium">Verloren</th>
              <th className="px-6 py-3 font-medium">Conversie</th>
              <th className="px-6 py-3 font-medium">Afgeronde contacten</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {perEmployee.map((employee) => (
              <tr key={employee.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium text-slate-900">
                  <div className="flex items-center gap-2">
                    <Avatar name={employee.name} />
                    {employee.name}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <Badge variant={ROLE_BADGE_VARIANT[employee.role]}>
                    {ROLE_LABELS[employee.role]}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-slate-500">
                  {employee.teamName ?? "—"}
                </td>
                <td className="px-6 py-4 text-slate-700">
                  {employee.totalLeads}
                </td>
                <td className="px-6 py-4 text-slate-700">{employee.won}</td>
                <td className="px-6 py-4 text-slate-700">{employee.lost}</td>
                <td className="px-6 py-4">
                  <Badge variant={conversionBadgeVariant(employee.conversionRate)}>
                    {employee.conversionRate === null
                      ? "—"
                      : `${employee.conversionRate}%`}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-slate-700">
                  {employee.activitiesCompleted}
                </td>
              </tr>
            ))}
            {perEmployee.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-6 py-8 text-center text-slate-400"
                >
                  Geen gebruikers in dit team.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
