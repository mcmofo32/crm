import { notFound } from "next/navigation";
import { Trophy, Medal, Crown } from "lucide-react";
import { getEffectiveViewer } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { canManageIncentives } from "@/lib/permissions";
import {
  deleteIncentiveAction,
  getIncentiveLeaderboard,
} from "@/lib/actions/incentives";
import { METRIC_LABELS } from "@/lib/incentiveMetrics";
import { IncentiveMode } from "@/generated/prisma/client";
import { Badge } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";

const MEDAL_COLORS = ["#eab308", "#94a3b8", "#b45309"];

const LEAD_TYPE_FILTER_LABELS: Record<string, string> = {
  FA: "Enkel Leads FA",
  RG: "Enkel Leads RG",
};

export default async function IncentiveDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = (await getEffectiveViewer())!;

  const incentive = await prisma.incentive.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      categories: { orderBy: { order: "asc" } },
    },
  });
  if (!incentive) notFound();

  const leaderboard = await getIncentiveLeaderboard(id);
  const now = new Date();
  const isActive = now >= incentive.startDate && now <= incentive.endDate;
  const hasPoster = Boolean(incentive.posterMimeType);
  const isImage = incentive.posterMimeType?.startsWith("image/");
  const boundDelete = deleteIncentiveAction.bind(null, id);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">
            {incentive.title}
          </h1>
          <p className="mt-1 text-base text-slate-500">
            {incentive.startDate.toLocaleDateString("nl-BE", {
              timeZone: "Europe/Brussels",
            })}{" "}
            —{" "}
            {incentive.endDate.toLocaleDateString("nl-BE", {
              timeZone: "Europe/Brussels",
            })}{" "}
            · Aangemaakt door{" "}
            {incentive.createdBy.name}
          </p>
        </div>
        <Badge variant={isActive ? "green" : "slate"} className="text-sm">
          {isActive ? "Actief" : "Afgelopen"}
        </Badge>
      </div>

      {hasPoster && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/incentives/${incentive.id}/poster`}
              alt={incentive.title}
              className="mx-auto max-h-[36rem] w-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 p-10">
              <p className="text-base text-slate-500">
                De poster is een PDF-bestand.
              </p>
              <a
                href={`/api/incentives/${incentive.id}/poster`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md bg-slate-900 px-4 py-2 text-base font-medium text-white hover:bg-slate-800"
              >
                Poster openen
              </a>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-2 text-lg font-medium text-slate-900">
          Vereisten om te winnen
        </h2>
        <p className="whitespace-pre-wrap text-base text-slate-600">
          {incentive.description}
        </p>
        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-500">
          {incentive.mode === IncentiveMode.TOP_N ? (
            <>
              <div>
                Ranglijst gebaseerd op:{" "}
                {METRIC_LABELS[incentive.rankingMetric ?? "CLIENTS_WON"]}
              </div>
              {incentive.rankingLeadType && (
                <div>{LEAD_TYPE_FILTER_LABELS[incentive.rankingLeadType]}</div>
              )}
              <div>Wint: Top {incentive.topN}</div>
            </>
          ) : (
            incentive.categories.map((cat) => (
              <div key={cat.id}>
                Richtcijfer — {METRIC_LABELS[cat.metric]}: min. {cat.targetValue}
                {cat.leadType ? ` (${LEAD_TYPE_FILTER_LABELS[cat.leadType]})` : ""}
              </div>
            ))
          )}
        </dl>
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-1.5 text-lg font-medium text-slate-900">
          <Trophy size={19} className="text-amber-500" />
          Ranglijst
        </h2>
        <ol className="flex flex-col gap-2">
          {leaderboard.map((entry, index) => (
            <li
              key={entry.userId}
              className={`flex flex-col gap-2 rounded-lg border p-4 ${
                entry.achieved
                  ? "border-amber-300 bg-amber-50"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex w-6 items-center justify-center">
                    {index < 3 ? (
                      <Medal size={18} color={MEDAL_COLORS[index]} />
                    ) : (
                      <span className="font-semibold text-slate-400">
                        {index + 1}
                      </span>
                    )}
                  </span>
                  <Avatar name={entry.name} />
                  <span className="font-medium text-slate-900">
                    {entry.name}
                  </span>
                  {entry.achieved && (
                    <Crown size={18} className="text-amber-500" />
                  )}
                </div>
                <span className="text-lg font-semibold text-slate-900">
                  {entry.progressPercent}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${
                    entry.achieved ? "bg-amber-500" : "bg-slate-900"
                  }`}
                  style={{ width: `${Math.min(entry.progressPercent, 100)}%` }}
                />
              </div>
              <p className="text-sm text-slate-500">
                {entry.categories && entry.categories.length > 0
                  ? entry.categories
                      .map((c) => `${c.label}: ${c.raw}/${c.target}`)
                      .join(" · ")
                  : `${entry.metricLabel ?? "Score"}: ${entry.score}`}
              </p>
            </li>
          ))}
          {leaderboard.length === 0 && (
            <p className="text-base text-slate-400">
              Nog geen gebruikers om te tonen.
            </p>
          )}
        </ol>
      </div>

      {canManageIncentives(user) && (
        <form action={boundDelete}>
          <button
            type="submit"
            className="w-fit rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Evenement verwijderen
          </button>
        </form>
      )}
    </div>
  );
}
