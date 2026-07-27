"use client";

import { useTransition } from "react";
import {
  cancelActivityAction,
  completeActivityAction,
} from "@/lib/actions/activities";

export function ActivityButtons({ activityId }: { activityId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(() => {
            completeActivityAction(activityId);
          })
        }
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
