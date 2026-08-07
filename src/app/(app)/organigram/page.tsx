import { Network } from "lucide-react";
import { getFullOrgChart } from "@/lib/actions/orgChart";
import { OrgChartCanvas } from "@/components/OrgChartCanvas";

export default async function OrganigramPage() {
  const { roots, featured } = await getFullOrgChart();

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
      {roots.length > 0 ? (
        <OrgChartCanvas roots={roots} featured={featured} />
      ) : (
        <p className="text-base text-slate-400">Nog geen teams aangemaakt.</p>
      )}
    </div>
  );
}
