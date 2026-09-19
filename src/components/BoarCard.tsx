"use client";

import { useState, useTransition } from "react";
import { updateBoarInfoAction } from "@/lib/actions/leadProducts";
import { useToastAction } from "@/components/toast/useToastAction";
import { BOAR_STATUS_LABELS, BOAR_STATUS_ORDER, BOAR_STATUS_COLORS } from "@/lib/boarStatus";
import type { BoarStatus } from "@/generated/prisma/client";

/**
 * BOAR (Brand, Ongevallen en Andere Risico's) is niet de kernactiviteit van
 * Structuur A, maar wel handig om per klant bij te houden of hierrond al
 * iets loopt — een lichte tracker (status + vrije notities), los van de
 * gewone Producten-kaart.
 */
export function BoarCard({
  leadId,
  boarStatus,
  boarNotes,
  boarProductNotes,
  canEdit = true,
}: {
  leadId: string;
  boarStatus: BoarStatus | null;
  boarNotes: string | null;
  boarProductNotes: string | null;
  canEdit?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const { runWithToast } = useToastAction();
  const [status, setStatus] = useState<BoarStatus | "">(boarStatus ?? "");
  const [notes, setNotes] = useState(boarNotes ?? "");
  const [productNotes, setProductNotes] = useState(boarProductNotes ?? "");

  function submit() {
    const formData = new FormData();
    formData.set("boarStatus", status);
    formData.set("boarNotes", notes);
    formData.set("boarProductNotes", productNotes);
    startTransition(async () => {
      await runWithToast(() => updateBoarInfoAction(leadId, formData), "BOAR opgeslagen");
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <p className="mb-3 font-medium text-slate-900">
        BOAR
        <span className="ml-1.5 font-normal text-slate-400">
          (Brand, Ongevallen en Andere Risico&apos;s)
        </span>
      </p>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Status
          </span>
          <select
            value={status}
            disabled={!canEdit || pending}
            onChange={(e) => setStatus(e.target.value as BoarStatus)}
            className="rounded-md border border-slate-300 px-2 py-1.5 font-medium disabled:opacity-60"
            style={status ? BOAR_STATUS_COLORS[status] : undefined}
          >
            <option value="">— Kies status —</option>
            {BOAR_STATUS_ORDER.map((s) => (
              <option key={s} value={s} style={BOAR_STATUS_COLORS[s]}>
                {BOAR_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Notities
            </span>
            <textarea
              value={notes}
              disabled={!canEdit || pending}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="rounded-md border border-slate-300 px-2 py-1.5 disabled:bg-slate-50"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Producten
            </span>
            <textarea
              value={productNotes}
              disabled={!canEdit || pending}
              onChange={(e) => setProductNotes(e.target.value)}
              rows={3}
              placeholder="bv. welke polissen/verzekeringen"
              className="rounded-md border border-slate-300 px-2 py-1.5 disabled:bg-slate-50"
            />
          </label>
        </div>

        {canEdit && (
          <button
            type="button"
            disabled={pending}
            onClick={submit}
            className="self-start rounded-md bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            Opslaan
          </button>
        )}
      </div>
    </div>
  );
}
