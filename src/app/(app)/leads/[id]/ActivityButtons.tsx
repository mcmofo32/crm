"use client";

import { useState, useTransition } from "react";
import {
  cancelActivityAction,
  completeActivityAction,
} from "@/lib/actions/activities";

export function ActivityButtons({ activityId }: { activityId: string }) {
  const [pending, startTransition] = useTransition();
  const [reporting, setReporting] = useState(false);
  const [notes, setNotes] = useState("");

  if (reporting) {
    return (
      <div className="mt-2 flex flex-col gap-2">
        <textarea
          autoFocus
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Wat is er besproken? (bv. telefoongesprek gehad over ..., klant wil ..., volgende stap is ...)"
          rows={2}
          className="rounded-md border border-slate-300 px-2 py-1 text-xs"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await completeActivityAction(activityId, notes);
                setReporting(false);
              })
            }
            className="rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            Bevestigen
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setReporting(false)}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Annuleren
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => setReporting(true)}
        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        Afgerond
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(() => {
            cancelActivityAction(activityId);
          })
        }
        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
      >
        Annuleren
      </button>
    </div>
  );
}
