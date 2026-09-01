"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  addFollowUpContractAction,
  deleteFollowUpContractAction,
} from "@/lib/actions/leadProducts";
import { useToastAction } from "@/components/toast/useToastAction";
import { PRODUCT_TYPE_LABELS, PRODUCT_TYPE_ORDER } from "@/lib/productTypes";
import type { ProductType } from "@/generated/prisma/client";

type FollowUpContract = {
  id: string;
  type: ProductType;
  amount: number;
  units: number;
  contractDate: Date;
};

function formatAmount(amount: number) {
  return amount.toLocaleString("nl-BE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });
}

function formatDate(date: Date) {
  return date.toLocaleDateString("nl-BE", {
    dateStyle: "medium",
    timeZone: "Europe/Brussels",
  });
}

function todayInputValue() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Vervolgcontracten die later, los van het initiële klantendossier, uit
 * opvolging komen (bv. een extra VAPZ-contract bij een bestaande klant) —
 * elk met zijn eigen datum, die bepaalt in welke productiemaand het
 * meetelt. Los van de vaste, één-per-type productenlijst op de
 * Producten-kaart: hetzelfde producttype mag hier meermaals voorkomen.
 */
export function FollowUpContractsCard({
  leadId,
  contracts,
  canEdit = true,
}: {
  leadId: string;
  contracts: FollowUpContract[];
  /** Enkel subagenten (of Beheerder/Admin) mogen klantendata zoals contracten aanpassen. */
  canEdit?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const { runWithToast } = useToastAction();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState<ProductType>(PRODUCT_TYPE_ORDER[0]);
  const [amount, setAmount] = useState("");
  const [units, setUnits] = useState("");
  const [contractDate, setContractDate] = useState(todayInputValue());

  const sortedContracts = [...contracts].sort(
    (a, b) => b.contractDate.getTime() - a.contractDate.getTime()
  );
  const totalAmount = contracts.reduce((sum, c) => sum + c.amount, 0);
  const totalUnits = contracts.reduce((sum, c) => sum + c.units, 0);

  function resetForm() {
    setType(PRODUCT_TYPE_ORDER[0]);
    setAmount("");
    setUnits("");
    setContractDate(todayInputValue());
    setAdding(false);
  }

  function submit() {
    const formData = new FormData();
    formData.set("type", type);
    formData.set("amount", amount);
    formData.set("units", units);
    formData.set("contractDate", contractDate);
    startTransition(async () => {
      await runWithToast(
        () => addFollowUpContractAction(leadId, formData),
        "Contract toegevoegd"
      );
      resetForm();
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="font-medium text-slate-900">
          Contracten uit opvolging
          {contracts.length > 0 && (
            <span className="ml-1.5 font-normal text-slate-400">
              ({contracts.length})
            </span>
          )}
        </span>
        <span className="text-xs text-slate-400">
          {open ? "Verbergen" : "Bekijken"}
        </span>
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-3 border-t border-slate-100 pt-3">
          {sortedContracts.length === 0 ? (
            <p className="text-slate-400">Nog geen vervolgcontracten toegevoegd.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {sortedContracts.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="text-slate-600">
                      {PRODUCT_TYPE_LABELS[c.type]}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatDate(c.contractDate)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-900">
                      {formatAmount(c.amount)} · {c.units} eenh.
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        disabled={pending}
                        title="Verwijderen"
                        onClick={() => {
                          if (confirm("Dit vervolgcontract verwijderen?")) {
                            startTransition(async () => {
                              await deleteFollowUpContractAction(c.id);
                            });
                          }
                        }}
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </li>
              ))}
              <li className="mt-1 flex items-center justify-between border-t border-slate-100 pt-2 font-medium text-slate-900">
                <span>Totaal</span>
                <span>
                  {formatAmount(totalAmount)} · {totalUnits} eenh.
                </span>
              </li>
            </ul>
          )}

          {canEdit &&
            (adding ? (
              <div className="flex flex-col gap-2 rounded-md border border-slate-200 p-3">
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as ProductType)}
                  className="rounded-md border border-slate-300 px-2 py-1.5"
                >
                  {PRODUCT_TYPE_ORDER.map((t) => (
                    <option key={t} value={t}>
                      {PRODUCT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Bedrag (€)"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="rounded-md border border-slate-300 px-2 py-1.5"
                  />
                  <input
                    type="number"
                    min={0}
                    step="1"
                    placeholder="Eenheden"
                    value={units}
                    onChange={(e) => setUnits(e.target.value)}
                    className="rounded-md border border-slate-300 px-2 py-1.5"
                  />
                </div>
                <label className="flex flex-col gap-1 text-xs text-slate-500">
                  Datum
                  <input
                    type="date"
                    value={contractDate}
                    onChange={(e) => setContractDate(e.target.value)}
                    className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pending || !amount || Number(amount) <= 0}
                    onClick={submit}
                    className="rounded-md bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    Toevoegen
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={resetForm}
                    className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Annuleren
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="flex items-center gap-1.5 self-start rounded-md border border-dashed border-slate-300 px-3 py-1.5 text-slate-600 hover:bg-slate-50"
              >
                <Plus size={15} />
                Contract toevoegen
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
