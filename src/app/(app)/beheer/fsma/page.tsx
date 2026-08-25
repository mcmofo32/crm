import { redirect } from "next/navigation";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canManageUsers } from "@/lib/permissions";
import { getFsmaOverview } from "@/lib/actions/fsmaModules";
import {
  FSMA_MODULE_ORDER,
  FSMA_MODULE_LABELS,
  FSMA_MODULE_SHORT_LABELS,
  FSMA_STATUS_LABELS,
  FSMA_STATUS_COLORS,
} from "@/lib/fsmaLabels";

export default async function FsmaOverviewPage() {
  const viewer = await getEffectiveViewer();
  if (!viewer) redirect("/login");
  if (!canManageUsers(viewer)) redirect("/dashboard");

  const rows = await getFsmaOverview();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900">
          <GraduationCap size={26} />
          FSMA
        </h1>
        <p className="mt-1 text-base text-slate-500">
          Status van de verplichte vakbekwaamheidsmodules, per medewerker.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-base text-slate-500">Geen actieve medewerkers gevonden.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Naam</th>
                {FSMA_MODULE_ORDER.map((module) => (
                  <th
                    key={module}
                    title={FSMA_MODULE_LABELS[module]}
                    className="px-2 py-3 text-center font-medium"
                  >
                    {FSMA_MODULE_SHORT_LABELS[module]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.userId} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-900">
                    <Link href={`/beheer/gebruikers/${row.userId}`} className="hover:underline">
                      {row.name}
                    </Link>
                  </td>
                  {row.modules.map((m) => (
                    <td key={m.module} className="px-2 py-2.5 text-center">
                      <span
                        title={`${FSMA_MODULE_LABELS[m.module]}: ${FSMA_STATUS_LABELS[m.status]}`}
                        className="mx-auto flex h-4 w-4 rounded-sm"
                        style={{ background: FSMA_STATUS_COLORS[m.status].background }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500">
        {FSMA_MODULE_ORDER.map((module) => (
          <span key={module}>
            <strong className="text-slate-700">{FSMA_MODULE_SHORT_LABELS[module]}</strong>
            {" — "}
            {FSMA_MODULE_LABELS[module].replace(/^Module [\d.]+ — /, "")}
          </span>
        ))}
      </div>
    </div>
  );
}
