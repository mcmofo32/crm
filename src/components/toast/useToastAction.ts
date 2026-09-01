"use client";

import { useToast } from "@/components/toast/ToastProvider";

/**
 * Voor acties zonder omvattend <form> (bv. een knop met startTransition):
 * toont een melding na een geslaagde actie, of een foutmelding bij een fout
 * — en gooit die fout daarna gewoon opnieuw door, zodat bestaande
 * foutafhandeling (bv. de dichtstbijzijnde error-boundary) ongewijzigd blijft.
 */
export function useToastAction() {
  const { showToast } = useToast();

  async function runWithToast<T>(
    action: () => Promise<T>,
    successMessage = "Opgeslagen"
  ): Promise<T> {
    try {
      const result = await action();
      showToast(successMessage);
      return result;
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Er ging iets mis", "error");
      throw error;
    }
  }

  return { runWithToast };
}
