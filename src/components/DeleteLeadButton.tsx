"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteLeadAction } from "@/lib/actions/leads";

export function DeleteLeadButton({
  leadId,
  leadName,
  variant = "icon",
}: {
  leadId: string;
  leadName: string;
  variant?: "icon" | "button";
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleClick = () => {
    if (
      !confirm(
        `Lead "${leadName}" verwijderen? Ze verhuist naar de prullenbak en kan daar hersteld worden.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      await deleteLeadAction(leadId);
      // Terug naar de pagina waar je vandaan kwam (bv. Klanten of Pipeline),
      // i.p.v. een vast doel — behoudt ook de filters/query van die pagina.
      router.back();
      router.refresh();
    });
  };

  if (variant === "button") {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={handleClick}
        className="flex items-center gap-1.5 rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
      >
        <Trash2 size={15} />
        Lead verwijderen
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleClick}
      title="Lead verwijderen"
      className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
    >
      <Trash2 size={16} />
    </button>
  );
}
