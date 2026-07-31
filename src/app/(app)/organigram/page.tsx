import { redirect } from "next/navigation";
import { Network } from "lucide-react";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canManageUsers } from "@/lib/permissions";
import { getFullOrgChart, getMyOrgChart } from "@/lib/actions/orgChart";
import { Role } from "@/generated/prisma/client";
import { OrgChartNode } from "@/components/OrgChartNode";

export default async function OrganigramPage() {
  const viewer = (await getEffectiveViewer())!;

  if (canManageUsers(viewer)) {
    const roots = await getFullOrgChart();
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900">
            <Network size={24} />
            Organigram
          </h1>
          <p className="mt-1 text-base text-slate-500">
            De volledige structuur van het bedrijf: wie coacht wie.
          </p>
        </div>
        <div className="flex flex-col gap-8">
          {roots.map((root) => (
            <OrgChartNode key={root.id} node={root} />
          ))}
          {roots.length === 0 && (
            <p className="text-base text-slate-400">Nog geen teams aangemaakt.</p>
          )}
        </div>
      </div>
    );
  }

  if (viewer.role === Role.COACH) {
    const { upline, tree } = await getMyOrgChart();
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900">
            <Network size={24} />
            Mijn structuur
          </h1>
          {upline && (
            <p className="mt-1 text-base text-slate-500">
              Jij rapporteert aan <strong>{upline.name}</strong>.
            </p>
          )}
        </div>
        <OrgChartNode node={tree} />
      </div>
    );
  }

  redirect("/dashboard");
}
