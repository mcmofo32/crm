import Link from "next/link";
import { Plus, Trophy, FileText } from "lucide-react";
import { getEffectiveViewer } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { canManageIncentives } from "@/lib/permissions";
import { Badge } from "@/components/Badge";

export default async function IncentivesPage() {
  const user = (await getEffectiveViewer())!;

  const incentives = await prisma.incentive.findMany({
    orderBy: { startDate: "desc" },
  });
  const now = new Date();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <Trophy size={20} />
            </span>
            Incentives
          </h1>
          <p className="mt-1 text-base text-slate-500">
            Evenementen en wedstrijden om het team te motiveren.
          </p>
        </div>
        {canManageIncentives(user) && (
          <Link
            href="/incentives/new"
            className="flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2.5 text-base font-medium text-white hover:bg-slate-800"
          >
            <Plus size={17} />
            Nieuw evenement
          </Link>
        )}
      </div>

      {incentives.length === 0 ? (
        <p className="text-base text-slate-500">Nog geen incentives.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {incentives.map((incentive) => {
            const isActive =
              now >= incentive.startDate && now <= incentive.endDate;
            const hasPoster = Boolean(incentive.posterMimeType);
            const isImage = incentive.posterMimeType?.startsWith("image/");

            return (
              <Link
                key={incentive.id}
                href={`/incentives/${incentive.id}`}
                className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300"
              >
                <div className="flex h-40 items-center justify-center bg-slate-100">
                  {hasPoster && isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/incentives/${incentive.id}/poster`}
                      alt={incentive.title}
                      className="h-full w-full object-cover"
                    />
                  ) : hasPoster ? (
                    <span className="flex items-center gap-1.5 text-base text-slate-500">
                      <FileText size={18} />
                      PDF-poster
                    </span>
                  ) : (
                    <span className="text-base text-slate-400">Geen poster</span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-medium text-slate-900">
                      {incentive.title}
                    </h2>
                    <Badge variant={isActive ? "green" : "slate"}>
                      {isActive ? "Actief" : "Afgelopen"}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-500">
                    {incentive.startDate.toLocaleDateString("nl-BE")} —{" "}
                    {incentive.endDate.toLocaleDateString("nl-BE")}
                  </p>
                  <p className="line-clamp-2 text-base text-slate-600">
                    {incentive.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
