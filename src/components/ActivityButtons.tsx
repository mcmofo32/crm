"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  cancelActivityAction,
  completeActivityAction,
  updateActivityAction,
  deleteActivityAction,
} from "@/lib/actions/activities";
import { ACTIVITY_SUBJECT_SUGGESTIONS } from "@/lib/activitySubjects";

const ACTIVITY_TYPE_OPTIONS = [
  { value: "CALL", label: "Telefoongesprek" },
  { value: "MEETING", label: "Afspraak" },
  { value: "EMAIL", label: "E-mail" },
  { value: "NOTE", label: "Notitie" },
];

const CUSTOM_SUBJECT = "__custom__";

function toDatetimeLocalValue(date: Date | null) {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ActivityButtons({
  activityId,
  type,
  subject,
  scheduledAt,
  durationMinutes,
  status,
  canDelete,
}: {
  activityId: string;
  type: string;
  subject: string;
  scheduledAt: Date | null;
  durationMinutes: number | null;
  status: string;
  canDelete: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"idle" | "reporting" | "editing">("idle");
  const [reportNotes, setReportNotes] = useState("");
  const [subjectPreset, setSubjectPreset] = useState(
    ACTIVITY_SUBJECT_SUGGESTIONS.includes(subject) ? subject : CUSTOM_SUBJECT
  );
  const [customSubject, setCustomSubject] = useState(
    ACTIVITY_SUBJECT_SUGGESTIONS.includes(subject) ? "" : subject
  );

  const deleteButton = canDelete && (
    <button
      type="button"
      disabled={pending}
      title="Verwijderen"
      onClick={() => {
        if (
          confirm(
            "Deze afspraak definitief verwijderen? Dit kan niet ongedaan gemaakt worden."
          )
        ) {
          startTransition(() => {
            deleteActivityAction(activityId);
          });
        }
      }}
      className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
    >
      <Trash2 size={14} />
    </button>
  );

  if (status !== "PLANNED") {
    return deleteButton ? <div className="flex items-center">{deleteButton}</div> : null;
  }

  if (mode === "reporting") {
    return (
      <div className="mt-2 flex flex-col gap-2">
        <textarea
          autoFocus
          value={reportNotes}
          onChange={(e) => setReportNotes(e.target.value)}
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
                await completeActivityAction(activityId, reportNotes);
                setMode("idle");
              })
            }
            className="rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            Bevestigen
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setMode("idle")}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Annuleren
          </button>
        </div>
      </div>
    );
  }

  if (mode === "editing") {
    return (
      <form
        action={(formData) =>
          startTransition(async () => {
            await updateActivityAction(activityId, formData);
            setMode("idle");
          })
        }
        className="mt-2 grid w-64 grid-cols-2 gap-2 text-xs"
      >
        <select
          name="type"
          defaultValue={type}
          className="col-span-2 rounded-md border border-slate-300 px-2 py-1"
        >
          {ACTIVITY_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={subjectPreset}
          onChange={(e) => setSubjectPreset(e.target.value)}
          className="col-span-2 rounded-md border border-slate-300 px-2 py-1"
        >
          {ACTIVITY_SUBJECT_SUGGESTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          <option value={CUSTOM_SUBJECT}>Andere (zelf ingeven)…</option>
        </select>
        {subjectPreset === CUSTOM_SUBJECT ? (
          <input
            name="subject"
            value={customSubject}
            onChange={(e) => setCustomSubject(e.target.value)}
            required
            className="col-span-2 rounded-md border border-slate-300 px-2 py-1"
          />
        ) : (
          <input type="hidden" name="subject" value={subjectPreset} />
        )}
        <input
          type="datetime-local"
          name="scheduledAt"
          defaultValue={toDatetimeLocalValue(scheduledAt)}
          required
          className="rounded-md border border-slate-300 px-2 py-1"
        />
        <select
          name="durationMinutes"
          defaultValue={String(durationMinutes ?? 15)}
          className="rounded-md border border-slate-300 px-2 py-1"
        >
          <option value="15">15 min</option>
          <option value="30">30 min</option>
          <option value="45">45 min</option>
          <option value="60">60 min</option>
        </select>
        <textarea
          name="notes"
          required
          rows={2}
          placeholder="Reden van wijziging (verplicht)"
          className="col-span-2 rounded-md border border-slate-300 px-2 py-1"
        />
        <div className="col-span-2 flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            Opslaan
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setMode("idle")}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Sluiten
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => setMode("editing")}
        title="Wijzigen"
        className="flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        <Pencil size={12} />
        Wijzigen
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setMode("reporting")}
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
      {deleteButton}
    </div>
  );
}
