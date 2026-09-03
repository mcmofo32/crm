"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { useToastAction } from "@/components/toast/useToastAction";

/** Klein "x"-knopje voor het verwijderen van een tabblad/categorie-pil (zie LibraryTabsBar). */
export function DeleteLibraryEntryButton({
  confirmMessage,
  successMessage,
  action,
}: {
  confirmMessage: string;
  successMessage: string;
  action: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const { runWithToast } = useToastAction();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(confirmMessage)) return;
    startTransition(async () => {
      try {
        await runWithToast(action, successMessage);
      } catch {
        // Foutmelding is al getoond door runWithToast.
      }
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleClick}
      title="Verwijderen"
      className="inline-flex rounded-full p-0.5 opacity-60 hover:bg-black/10 hover:opacity-100 disabled:opacity-30"
    >
      <X size={12} />
    </button>
  );
}
