"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Trash2 } from "lucide-react";
import { deleteAllLeadsForOwnerAction } from "@/lib/actions/leads";
import { useToast } from "@/components/toast/ToastProvider";

export function BulkDeleteEmployeeLeadsButton({
  ownerId,
  ownerName,
  leadsCount,
}: {
  ownerId: string;
  ownerName: string;
  leadsCount: number;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { showToast } = useToast();
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (leadsCount === 0) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-slate-500">
        <Ban size={14} />
        Deze medewerker heeft momenteel geen leads.
      </p>
    );
  }

  const nameMatches = confirmText.trim().toLowerCase() === ownerName.trim().toLowerCase();

  function handleClick() {
    if (!nameMatches) return;
    if (
      !confirm(
        `Laatste bevestiging: alle ${leadsCount} leads van "${ownerName}" verwijderen (naar de prullenbak)? Elke lead is hierna nog apart te herstellen via Prullenbak.`
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const result = await deleteAllLeadsForOwnerAction(ownerId);
        showToast(
          `${result.count} ${result.count === 1 ? "lead" : "leads"} van ${ownerName} verwijderd (naar de prullenbak)`
        );
        setConfirmText("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Er ging iets mis. Probeer opnieuw.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-red-900">
          Typ de naam &quot;{ownerName}&quot; om te bevestigen:
        </label>
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={ownerName}
          className="rounded-md border border-red-300 bg-white px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button
        type="button"
        disabled={!nameMatches || pending}
        onClick={handleClick}
        className="flex w-fit items-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Trash2 size={15} />
        Alle {leadsCount} leads verwijderen
      </button>
    </div>
  );
}
