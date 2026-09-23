"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";
import { switchLeadTypeAction } from "@/lib/actions/leads";
import { useToastAction } from "@/components/toast/useToastAction";
import type { LeadType } from "@/generated/prisma/client";

const OTHER_TYPE_LABEL: Record<LeadType, string> = {
  FA: "RG",
  RG: "FA",
};

export function SwitchLeadTypeButton({
  leadId,
  leadName,
  leadType,
}: {
  leadId: string;
  leadName: string;
  leadType: LeadType;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { runWithToast } = useToastAction();
  const targetType = OTHER_TYPE_LABEL[leadType];

  function handleClick() {
    if (
      !confirm(
        `"${leadName}" verplaatsen naar de ${targetType}-funnel? De huidige fase wordt vervangen door de overeenkomstige fase in die funnel.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      await runWithToast(async () => {
        const result = await switchLeadTypeAction(leadId);
        if (result?.error) throw new Error(result.error);
      }, `Verplaatst naar ${targetType}`);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleClick}
      title={`Verplaatsen naar de ${targetType}-funnel`}
      className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      <ArrowLeftRight size={15} />
      Naar {targetType}
    </button>
  );
}
