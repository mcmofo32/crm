"use client";

import { useTransition } from "react";
import { updateLeadStageAction } from "@/lib/actions/leads";

export function StageSelect({
  leadId,
  currentStageId,
  stages,
}: {
  leadId: string;
  currentStageId: string;
  stages: { id: string; label: string }[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      aria-label="Funnel-fase"
      defaultValue={currentStageId}
      disabled={pending}
      onChange={(e) =>
        startTransition(() => {
          updateLeadStageAction(leadId, e.target.value);
        })
      }
      className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
    >
      {stages.map((stage) => (
        <option key={stage.id} value={stage.id}>
          {stage.label}
        </option>
      ))}
    </select>
  );
}
