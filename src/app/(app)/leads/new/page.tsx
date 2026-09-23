import Link from "next/link";
import { getEffectiveViewer } from "@/lib/impersonation";
import { getAssignableUsers } from "@/lib/actions/leads";
import { CreateLeadForm } from "@/components/CreateLeadForm";
import { ToastOnParam } from "@/components/toast/ToastOnParam";
import { LeadType } from "@/generated/prisma/client";

export default async function NewLeadPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    created?: string;
    duplicateName?: string;
    duplicateOwner?: string;
  }>;
}) {
  const { type, duplicateName, duplicateOwner } = await searchParams;
  // Vanuit Funnel/Pipeline/Leads FA of RG komt de funnel automatisch mee in
  // de link; zonder die context (bv. rechtstreeks naar /leads/new) valt dit
  // terug op FA — er is dus geen keuzeveld meer nodig.
  const leadType: LeadType = type === "RG" ? "RG" : "FA";
  const viewer = (await getEffectiveViewer())!;
  const assignableUsers = await getAssignableUsers();

  return (
    <div className="max-w-xl">
      <ToastOnParam param="created" message="Lead aangemaakt" />
      {duplicateName && duplicateOwner && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
          Let op: <strong>{duplicateName}</strong> staat al als lead
          geregistreerd bij <strong>{duplicateOwner}</strong> (zelfde
          e-mailadres of telefoonnummer). Deze nieuwe lead is wel aangemaakt —
          neem contact op met een beheerder om dit na te kijken.
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
          Nieuwe lead
        </h1>
        <Link
          href="/leads/bulk"
          className="text-sm text-slate-500 underline hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
        >
          Meerdere leads in bulk toevoegen
        </Link>
      </div>
      <CreateLeadForm
        leadType={leadType}
        viewerId={viewer.id}
        assignableUsers={assignableUsers}
      />
    </div>
  );
}
