"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X } from "lucide-react";
import {
  setPolicyStatusAction,
  setPolicyReducedAmountAction,
} from "@/lib/actions/policies";
import { useToastAction } from "@/components/toast/useToastAction";

function formatAmount(amount: number) {
  return amount.toLocaleString("nl-BE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });
}

/**
 * Bedrag + premievrij-status van één product/contract, rechtstreeks
 * bewerkbaar vanop het lead-profiel (Producten/Contracten uit opvolging) —
 * dezelfde twee acties als op de Polissen-pagina (setPolicyStatusAction/
 * setPolicyReducedAmountAction), zodat een subagent hiervoor niet per se
 * naar Polissen moet. De rest van een polis (maatschappij, documenten,
 * ingangsdatum, ...) blijft wel Polissen-only.
 */
export function PolicyQuickActions({
  policyId,
  amount,
  reducedAmount,
  lumpSumAmount = null,
  premievrij,
  units,
  canEdit,
}: {
  /** null zolang deze polis-lijn nog niet aangemaakt is (zeldzaam — zie backfillMissingPolicies). */
  policyId: string | null;
  amount: number;
  reducedAmount: number | null;
  /** Eenmalige koopsom, los van `amount` — telt niet mee in het maandelijkse incasso. */
  lumpSumAmount?: number | null;
  premievrij: boolean;
  units: number;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { runWithToast } = useToastAction();
  const [editingAmount, setEditingAmount] = useState(false);
  const [amountInput, setAmountInput] = useState(String(reducedAmount ?? amount));

  function togglePremievrij() {
    if (!policyId) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("status", premievrij ? "ACTIEF" : "PREMIEVRIJ");
      await runWithToast(
        () => setPolicyStatusAction(policyId, formData),
        premievrij ? "Premievrij opgeheven" : "Premievrij gezet"
      );
      router.refresh();
    });
  }

  function saveAmount() {
    if (!policyId) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("reducedAmount", amountInput);
      await runWithToast(
        () => setPolicyReducedAmountAction(policyId, formData),
        "Bedrag aangepast"
      );
      setEditingAmount(false);
      router.refresh();
    });
  }

  const showPremievrijToggle = canEdit && policyId;

  return (
    <span className="flex items-center gap-1.5">
      {premievrij &&
        (showPremievrijToggle ? (
          <button
            type="button"
            disabled={pending}
            onClick={togglePremievrij}
            title="Klik om premievrij op te heffen"
            className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700 hover:bg-red-200 disabled:opacity-60"
          >
            Premievrij
          </button>
        ) : (
          <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
            Premievrij
          </span>
        ))}

      {editingAmount ? (
        <span className="flex items-center gap-1">
          <input
            type="number"
            min="0"
            step="0.01"
            autoFocus
            disabled={pending}
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            className="w-20 rounded border border-slate-300 px-1.5 py-0.5 text-xs disabled:opacity-60"
          />
          <button
            type="button"
            disabled={pending}
            onClick={saveAmount}
            title="Opslaan"
            className="text-green-600 hover:text-green-700 disabled:opacity-60"
          >
            <Check size={14} />
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setAmountInput(String(reducedAmount ?? amount));
              setEditingAmount(false);
            }}
            title="Annuleren"
            className="text-slate-400 hover:text-slate-600 disabled:opacity-60"
          >
            <X size={14} />
          </button>
        </span>
      ) : (
        <span className="text-slate-900">
          {reducedAmount !== null ? (
            <>
              <span className="font-medium text-red-700">{formatAmount(reducedAmount)}</span>{" "}
              <span className="text-xs text-slate-400 line-through">{formatAmount(amount)}</span>
            </>
          ) : (
            formatAmount(amount)
          )}{" "}
          · {units} eenh.
        </span>
      )}
      {lumpSumAmount !== null && (
        <span
          title="Eenmalige koopsom — telt niet mee in het maandelijkse incasso"
          className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700"
        >
          Koopsom {formatAmount(lumpSumAmount)}
        </span>
      )}
      {canEdit && policyId && !editingAmount && (
        <button
          type="button"
          onClick={() => {
            setAmountInput(String(reducedAmount ?? amount));
            setEditingAmount(true);
          }}
          title="Bedrag wijzigen"
          className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <Pencil size={12} />
        </button>
      )}
    </span>
  );
}
