import Link from "next/link";
import { notFound } from "next/navigation";
import { Phone, Voicemail, PhoneCall, Megaphone } from "lucide-react";
import {
  getPipelineStats,
  getPipelineLeads,
  setLeadQualityScoreAction,
  setLeadInformedAction,
  setLeadCharacteristicsAction,
} from "@/lib/actions/pipeline";
import { InlineSelect } from "@/components/InlineSelect";
import { InlineCheckbox } from "@/components/InlineCheckbox";
import { InlineTextField } from "@/components/InlineTextField";

const TYPE_MAP = { verkoop: "FA", recrutering: "RG" } as const;
const TITLES = { verkoop: "Pipeline verkoop", recrutering: "Pipeline recrutering" } as const;

function formatDate(date: Date | null) {
  if (!date) return "—";
  return date.toLocaleDateString("nl-BE", { dateStyle: "medium" });
}

const SCORE_OPTIONS = Array.from({ length: 11 }, (_, i) => ({
  value: String(i),
  label: String(i),
}));

export default async function PipelinePage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  if (type !== "verkoop" && type !== "recrutering") notFound();

  const leadType = TYPE_MAP[type];
  const isRecrutering = type === "recrutering";

  const [stats, leads] = await Promise.all([
    getPipelineStats(leadType),
    getPipelineLeads(leadType),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
            <Phone size={20} />
          </span>
          {TITLES[type]}
        </h1>
        <p className="mt-1 text-base text-slate-500">
          Eerste contactopvolging vóór een afspraak wordt ingepland.
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-5 py-4 text-base text-blue-800">
        <Megaphone size={20} className="flex-shrink-0" />
        <span>
          <strong>{stats.openReferrals}</strong> openstaande aanbevelingen —
          leads met een bron waarmee nog geen contact is geweest.
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <StatCard
          label="Te contacteren"
          value={stats.teContacteren}
          icon={Phone}
          color="bg-slate-100 text-slate-700"
        />
        <StatCard
          label="Voicemail"
          value={stats.voicemail}
          icon={Voicemail}
          color="bg-amber-100 text-amber-700"
        />
        <StatCard
          label="Terugkoppelen"
          value={stats.terugkoppelen}
          icon={PhoneCall}
          color="bg-blue-100 text-blue-700"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Datum</th>
              <th className="px-4 py-3 font-medium">Naam</th>
              <th className="px-4 py-3 font-medium">Nummer</th>
              <th className="px-4 py-3 font-medium">Aanbevolen door</th>
              {isRecrutering ? (
                <th className="px-4 py-3 font-medium">Kenmerken</th>
              ) : (
                <>
                  <th className="px-4 py-3 text-center font-medium">Op de hoogte</th>
                  <th className="px-4 py-3 font-medium">Cijfer op 10</th>
                  <th className="px-4 py-3 font-medium">Laatste contact</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-center font-medium">Aantal keer gebeld</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">
                  {formatDate(lead.createdAt)}
                </td>
                <td className="px-4 py-2.5 font-medium text-slate-900">
                  <Link href={`/leads/${lead.id}`} className="hover:underline">
                    {lead.firstName} {lead.lastName}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-slate-600">{lead.phone || "—"}</td>
                <td className="px-4 py-2.5 text-slate-600">{lead.source || "—"}</td>
                {isRecrutering ? (
                  <td className="px-4 py-2.5">
                    <InlineTextField
                      action={setLeadCharacteristicsAction.bind(null, lead.id)}
                      name="characteristics"
                      value={lead.characteristics ?? ""}
                      placeholder="Vrij in te vullen…"
                    />
                  </td>
                ) : (
                  <>
                    <td className="px-4 py-2.5 text-center">
                      <InlineCheckbox
                        action={setLeadInformedAction.bind(null, lead.id)}
                        name="isInformed"
                        checked={lead.isInformed}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <InlineSelect
                        action={setLeadQualityScoreAction.bind(null, lead.id)}
                        name="qualityScore"
                        value={lead.qualityScore != null ? String(lead.qualityScore) : ""}
                        options={[{ value: "", label: "—" }, ...SCORE_OPTIONS]}
                        className="w-16 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {formatDate(lead.lastContactedAt)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{lead.statusLabel}</td>
                    <td className="px-4 py-2.5 text-center text-slate-600">
                      {lead.callCount}
                    </td>
                  </>
                )}
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td
                  colSpan={isRecrutering ? 5 : 9}
                  className="px-4 py-8 text-center text-slate-400"
                >
                  Nog geen leads.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: typeof Phone;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <span
        className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${color}`}
      >
        <Icon size={20} />
      </span>
      <p className="text-base text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
