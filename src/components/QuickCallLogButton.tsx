"use client";

import { useState, useTransition } from "react";
import { Phone } from "lucide-react";
import { useRouter } from "next/navigation";
import { logCompletedActivityAction } from "@/lib/actions/activities";
import { useToastAction } from "@/components/toast/useToastAction";

/** Compacte knop (bv. in een Pipeline-rij) om snel een uitgaand telefoongesprek te loggen, inclusief voicemail. */
export function QuickCallLogButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { runWithToast } = useToastAction();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [wasVoicemail, setWasVoicemail] = useState(false);

  function reset() {
    setOpen(false);
    setNotes("");
    setWasVoicemail(false);
  }

  if (open) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
        <div className="flex w-full max-w-md flex-col gap-2 rounded-lg bg-white p-4 shadow-xl">
          <label className="text-sm font-medium text-slate-700">
            Telefoongesprek loggen
          </label>
          <textarea
            autoFocus
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Wat is er besproken? (optioneel)"
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
          <label className="flex items-center gap-1.5 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={wasVoicemail}
              onChange={(e) => setWasVoicemail(e.target.checked)}
            />
            Voicemail (niet bereikt)
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const formData = new FormData();
                  formData.set("leadId", leadId);
                  formData.set("type", "CALL");
                  formData.set("subject", "Telefoongesprek");
                  formData.set("notes", notes);
                  if (wasVoicemail) formData.set("wasVoicemail", "on");
                  await runWithToast(
                    () => logCompletedActivityAction(formData),
                    "Telefoongesprek gelogd"
                  );
                  reset();
                  router.refresh();
                })
              }
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              Bevestigen
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={reset}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Annuleren
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => setOpen(true)}
      title="Telefoongesprek loggen"
      className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-60"
    >
      <Phone size={14} />
    </button>
  );
}
