"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast/ToastProvider";

/**
 * Bulkknop op "Klanten onder beheer" (enkel voor Beheerder/Admin) om de
 * BOAR-status van alle klanten in één keer op "Nog contacteren" te zetten,
 * i.p.v. elk klantprofiel apart te moeten doorlopen.
 */
export function BulkBoarTodoButton({
  action,
}: {
  action: () => Promise<{ count: number }>;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (
          !confirm(
            'Dit zet de BOAR-status van ALLE klanten op "Nog contacteren", ongeacht hun huidige status. Doorgaan?'
          )
        ) {
          return;
        }
        startTransition(async () => {
          const result = await action();
          showToast(`${result.count} klanten op "Nog contacteren" gezet`);
          router.refresh();
        });
      }}
      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
    >
      {pending ? "Bezig…" : "Alle klanten op BOAR: nog te doen"}
    </button>
  );
}
