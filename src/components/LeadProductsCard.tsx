"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { saveLeadProductsAction } from "@/lib/actions/leadProducts";
import { useToastAction } from "@/components/toast/useToastAction";
import {
  ProductFields,
  buildProductsFormData,
  type ProductsState,
} from "@/components/ProductFields";
import { PRODUCT_TYPE_LABELS, PRODUCT_TYPE_ORDER } from "@/lib/productTypes";
import { PolicyQuickActions } from "@/components/PolicyQuickActions";
import type { ProductType } from "@/generated/prisma/client";

type ProductRecord = {
  type: ProductType;
  amount: number;
  units: number;
  /** Eenmalige koopsom, los van het maandelijkse `amount` — zie schema.prisma. */
  lumpSumAmount: number | null;
  /** Bepaalt in welke productiemaand dit product telt (zie saveLeadProductsAction). */
  contractDate: Date;
  /** Komt van de bijhorende polis-lijn (zie Policy op /subagent/polissen) — null zolang die nog niet aangemaakt is. */
  policyId: string | null;
  premievrij: boolean;
  reducedAmount: number | null;
};

function formatAmount(amount: number) {
  return amount.toLocaleString("nl-BE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function stateFromProducts(products: ProductRecord[]): ProductsState {
  const state: ProductsState = {};
  for (const p of products) {
    state[p.type] = {
      amount: String(p.amount),
      units: String(p.units),
      lumpSumAmount: p.lumpSumAmount !== null ? String(p.lumpSumAmount) : "",
      contractDate: toDateInputValue(p.contractDate),
    };
  }
  return state;
}

export function LeadProductsCard({
  leadId,
  products,
  canEdit = true,
}: {
  leadId: string;
  products: ProductRecord[];
  /** Enkel subagenten (of Beheerder/Admin) mogen klantendata zoals producten aanpassen. */
  canEdit?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const { runWithToast } = useToastAction();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<ProductsState>(() => stateFromProducts(products));

  const sortedProducts = [...products].sort(
    (a, b) => PRODUCT_TYPE_ORDER.indexOf(a.type) - PRODUCT_TYPE_ORDER.indexOf(b.type)
  );
  // Som van het effectieve (dus eventueel verlaagde) bedrag — anders klopt
  // het totaal niet meer zodra één van de producten verlaagd is.
  const totalAmount = products.reduce((sum, p) => sum + (p.reducedAmount ?? p.amount), 0);
  const totalUnits = products.reduce((sum, p) => sum + p.units, 0);
  // Apart totaal, bewust niet opgeteld bij totalAmount — een koopsom is geen
  // maandelijks bedrag en telt dus ook niet mee in het incasso.
  const totalLumpSum = products.reduce((sum, p) => sum + (p.lumpSumAmount ?? 0), 0);

  if (editing) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 font-medium text-slate-900 dark:text-slate-100">Producten bewerken</h2>
        <ProductFields value={value} onChange={setValue} />
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await runWithToast(
                  () => saveLeadProductsAction(leadId, buildProductsFormData(value)),
                  "Producten opgeslagen"
                );
                setEditing(false);
              })
            }
            className="rounded-md bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
          >
            Opslaan
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setValue(stateFromProducts(products));
              setEditing(false);
            }}
            className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Annuleren
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium text-slate-900 dark:text-slate-100">Producten</h2>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Bewerken"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <Pencil size={13} />
            Bewerken
          </button>
        )}
      </div>
      {sortedProducts.length === 0 ? (
        <p className="text-slate-400 dark:text-slate-500">Nog geen producten toegevoegd.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sortedProducts.map((p) => (
            <li key={p.type} className="flex items-center justify-between gap-2">
              <span className="text-slate-600 dark:text-slate-400">{PRODUCT_TYPE_LABELS[p.type]}</span>
              <PolicyQuickActions
                policyId={p.policyId}
                amount={p.amount}
                reducedAmount={p.reducedAmount}
                lumpSumAmount={p.lumpSumAmount}
                premievrij={p.premievrij}
                units={p.units}
                canEdit={canEdit}
              />
            </li>
          ))}
          <li className="mt-1 flex items-center justify-between border-t border-slate-100 pt-2 font-medium text-slate-900 dark:border-slate-800 dark:text-slate-100">
            <span>Totaal</span>
            <span>
              {formatAmount(totalAmount)}/maand · {totalUnits} eenh.
            </span>
          </li>
          {totalLumpSum > 0 && (
            <li className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
              <span>Waarvan koopsom (niet in incasso)</span>
              <span>{formatAmount(totalLumpSum)}</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
