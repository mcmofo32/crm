"use client";

import { useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { restoreLeadAction } from "@/lib/actions/leads";

export function RestoreLeadButton({ leadId }: { leadId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(() => {
          restoreLeadAction(leadId);
        })
      }
      className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
    >
      <RotateCcw size={14} />
      Herstellen
    </button>
  );
}
