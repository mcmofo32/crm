import { redirect } from "next/navigation";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canManageIncentives } from "@/lib/permissions";
import { IncentiveForm } from "@/components/IncentiveForm";

export default async function NewIncentivePage() {
  const user = (await getEffectiveViewer())!;
  if (!canManageIncentives(user)) redirect("/incentives");

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-3xl font-semibold text-slate-900">
        Nieuw evenement
      </h1>
      <IncentiveForm />
    </div>
  );
}
