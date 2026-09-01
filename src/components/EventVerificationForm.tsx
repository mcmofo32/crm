"use client";

import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { ATTENDANCE_STATUS_LABELS } from "@/lib/eventTypes";
import type { EventVerificationRow } from "@/lib/actions/events";
import { FormToast } from "@/components/toast/FormToast";

type ActualStatus = "GOING" | "NOT_GOING";

/**
 * Bevestigingslijst (met dropdown per persoon) plus twee live meelopende
 * kolommen "Aanwezige leden"/"Afwezige leden" ernaast, zodat je in één
 * oogopslag ziet wie waar staat terwijl je de dropdowns aanpast — i.p.v.
 * enkel de ene lijst met dropdowns te moeten aflezen.
 */
export function EventVerificationForm({
  rows,
  verifyAction,
  formKey,
  submitLabel,
}: {
  rows: EventVerificationRow[];
  verifyAction: (formData: FormData) => void | Promise<void>;
  formKey: string | number;
  submitLabel: string;
}) {
  const [statuses, setStatuses] = useState<Record<string, ActualStatus>>(() =>
    Object.fromEntries(
      rows.map((row) => [
        row.userId,
        row.actualStatus === "NOT_GOING" ? "NOT_GOING" : "GOING",
      ])
    )
  );

  const present = rows.filter((row) => statuses[row.userId] === "GOING");
  const absent = rows.filter((row) => statuses[row.userId] === "NOT_GOING");

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <form key={formKey} action={verifyAction} className="flex flex-col gap-3">
        <FormToast message="Aanwezigheid opgeslagen" />
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li
              key={row.userId}
              className="flex items-center justify-between gap-3"
            >
              <span className="flex items-center gap-2 text-sm text-slate-700">
                <Avatar name={row.name} />
                {row.name}
                <span className="text-xs text-slate-400">
                  (gaf zelf op: {ATTENDANCE_STATUS_LABELS[row.status]})
                </span>
              </span>
              <select
                name={`actual_${row.userId}`}
                value={statuses[row.userId]}
                onChange={(e) =>
                  setStatuses((prev) => ({
                    ...prev,
                    [row.userId]: e.target.value as ActualStatus,
                  }))
                }
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="GOING">Aanwezig</option>
                <option value="NOT_GOING">Niet aanwezig</option>
              </select>
            </li>
          ))}
        </ul>
        <div>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            {submitLabel}
          </button>
        </div>
      </form>

      <AttendanceColumn title="Aanwezige leden" rows={present} variant="green" />
      <AttendanceColumn title="Afwezige leden" rows={absent} variant="red" />
    </div>
  );
}

function AttendanceColumn({
  title,
  rows,
  variant,
}: {
  title: string;
  rows: EventVerificationRow[];
  variant: "green" | "red";
}) {
  const dotClass = variant === "green" ? "bg-green-500" : "bg-red-500";
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h3 className="mb-3 text-sm font-medium text-slate-900">
        {title} ({rows.length})
      </h3>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-400">Niemand</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li
              key={row.userId}
              className="flex items-center gap-2 text-sm text-slate-700"
            >
              <span
                className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${dotClass}`}
              />
              <Avatar name={row.name} />
              {row.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
