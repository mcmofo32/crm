"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { logCompletedActivityAction } from "@/lib/actions/activities";
import { FormToast } from "@/components/toast/FormToast";

const TYPE_OPTIONS = [
  { value: "CALL", label: "Telefoongesprek" },
  { value: "MEETING", label: "Afspraak" },
  { value: "EMAIL", label: "E-mail" },
  { value: "NOTE", label: "Notitie" },
];

/** Compacte knop naast "Communicatiegeschiedenis" om snel een afgerond contactmoment te loggen — zelfde overlay-patroon als QuickCallLogButton (ernaast), maar voor eender welk type i.p.v. enkel telefoongesprekken. */
export function ReportContactForm({
  leadId,
  assignableUsers,
  currentUserId,
}: {
  leadId: string;
  assignableUsers: { id: string; name: string }[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Contact rapporteren"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
      >
        <Plus size={14} />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form
        action={(formData) =>
          startTransition(async () => {
            await logCompletedActivityAction(formData);
            setNotes("");
            setOpen(false);
            router.refresh();
          })
        }
        className="flex w-full max-w-md flex-col gap-3 rounded-lg bg-white p-4 shadow-xl"
      >
        <FormToast message="Contact gerapporteerd" />
        <input type="hidden" name="leadId" value={leadId} />
        <label className="text-sm font-medium text-slate-700">
          Contact rapporteren
        </label>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <select
            name="type"
            defaultValue="CALL"
            className="rounded-md border border-slate-300 px-3 py-2"
          >
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {assignableUsers.length > 1 && (
            <select
              name="assigneeId"
              defaultValue={currentUserId}
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              {assignableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <textarea
          name="notes"
          autoFocus
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Wat is er besproken? (bv. telefoongesprek gehad over de offerte, klant twijfelt nog over de prijs, terugbellen volgende week)"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            Bevestigen
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setOpen(false)}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Annuleren
          </button>
        </div>
      </form>
    </div>
  );
}
