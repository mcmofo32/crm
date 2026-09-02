"use client";

import { useActionState, useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import {
  bulkDeleteExactDuplicatesAction,
  type DuplicateCleanupState,
} from "@/lib/actions/duplicates";
import { useToast } from "@/components/toast/ToastProvider";

/**
 * Ruimt in één klik alle duplicatengroepen op die niet enkel hetzelfde
 * e-mailadres/telefoonnummer delen, maar ook voor de rest (naam, type)
 * volledig identiek zijn — zodat je niet elke dubbele lead hieronder apart
 * moet verwijderen. Groepen waarin de namen verschillen (mogelijk gewoon
 * gedeelde contactgegevens tussen twee personen) blijven staan voor
 * manuele controle.
 */
export function BulkDuplicateCleanupButton() {
  const [state, formAction, pending] = useActionState<DuplicateCleanupState, FormData>(
    bulkDeleteExactDuplicatesAction,
    null
  );
  const wasPending = useRef(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (wasPending.current && !pending && state) {
      showToast(
        state.deletedCount > 0
          ? `${state.deletedCount} dubbele lead${state.deletedCount === 1 ? "" : "s"} verwijderd`
          : "Geen exacte duplicaten gevonden"
      );
    }
    wasPending.current = pending;
  }, [pending, state, showToast]);

  return (
    <form action={formAction}>
      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        <Sparkles size={15} />
        {pending ? "Bezig..." : "Ruim exacte duplicaten op"}
      </button>
      {state && state.skippedGroups > 0 && (
        <p className="mt-1.5 text-xs text-slate-400">
          {state.skippedGroups} groep{state.skippedGroups === 1 ? "" : "en"} overgeslagen
          (namen verschillen) — controleer hieronder manueel.
        </p>
      )}
    </form>
  );
}
