import { notFound } from "next/navigation";
import { Trophy, Medal } from "lucide-react";
import { getEffectiveViewer } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { canManageIncentives } from "@/lib/permissions";
import {
  deleteIncentiveAction,
  getIncentiveLeaderboard,
} from "@/lib/actions/incentives";
import { Badge } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";

const MEDAL_COLORS = ["#eab308", "#94a3b8", "#b45309"];

const GOAL_TYPE_LABELS = {
  LEADS_WON: "Gewonnen leads",
  ACTIVITIES_COMPLETED: "Afgeronde contactmomenten",
};

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
    include: { createdBy: { select: { name: true } } },
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
            {incentive.startDate.toLocaleDateString("nl-BE")} —{" "}
            {incentive.endDate.toLocaleDateString("nl-BE")} · Aangemaakt door{" "}
            {incentive.createdBy.name}
          </p>
        </div>
        <Badge variant={isActive ? "green" : "slate"} className="text-sm">
          {isActive ? "Actief" : "Afgelopen"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 flex flex-col gap-6">
          {hasPoster && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {isImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/incentives/${incentive.id}/poster`}
                  alt={incentive.title}
                  className="w-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 p-8">
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
            <dl className="mt-4 flex flex-col gap-1 text-sm text-slate-500">
              <div>
                Ranglijst gebaseerd op: {GOAL_TYPE_LABELS[incentive.goalType]}
              </div>
              {incentive.leadType && (
                <div>{LEAD_TYPE_FILTER_LABELS[incentive.leadType]}</div>
              )}
              {incentive.targetValue && (
                <div>Richtcijfer: {incentive.targetValue}</div>
              )}
            </dl>
          </div>

          {canManageIncentives(user) && (
            <form action={boundDelete}>
              <button
                type="submit"
                className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Evenement verwijderen
              </button>
            </form>
          )}
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
                className={`flex items-center justify-between rounded-lg border p-4 text-base ${
                  index === 0
                    ? "border-amber-300 bg-amber-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <span className="flex items-center gap-3">
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
                </span>
                <span className="text-lg font-semibold text-slate-900">
                  {entry.score}
                </span>
              </li>
            ))}
            {leaderboard.length === 0 && (
              <p className="text-base text-slate-400">
                Nog geen gebruikers om te tonen.
              </p>
            )}
          </ol>
        </div>
      </div>
    </div>
  );
}
