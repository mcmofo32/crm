"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteLibraryDocumentAction } from "@/lib/actions/library";
import { useToastAction } from "@/components/toast/useToastAction";

export function DeleteLibraryDocumentButton({
  documentId,
  title,
}: {
  documentId: string;
  title: string;
}) {
  const [pending, startTransition] = useTransition();
  const { runWithToast } = useToastAction();

  function handleClick() {
    if (!confirm(`Document "${title}" verwijderen? Dit kan niet ongedaan gemaakt worden.`)) {
      return;
    }
    startTransition(async () => {
      try {
        await runWithToast(() => deleteLibraryDocumentAction(documentId), "Document verwijderd");
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
      title="Document verwijderen"
      className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
    >
      <Trash2 size={14} />
      Verwijderen
    </button>
  );
}
