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
import type { ProductType } from "@/generated/prisma/client";

type ProductRecord = { type: ProductType; amount: number; units: number };

function formatAmount(amount: number) {
  return amount.toLocaleString("nl-BE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });
}

function stateFromProducts(products: ProductRecord[]): ProductsState {
  const state: ProductsState = {};
  for (const p of products) {
    state[p.type] = { amount: String(p.amount), units: String(p.units) };
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
  const totalAmount = products.reduce((sum, p) => sum + p.amount, 0);
  const totalUnits = products.reduce((sum, p) => sum + p.units, 0);

  if (editing) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <h2 className="mb-3 font-medium text-slate-900">Producten bewerken</h2>
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
            className="rounded-md bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-800 disabled:opacity-60"
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
            className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-50"
          >
            Annuleren
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium text-slate-900">Producten</h2>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Bewerken"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            <Pencil size={13} />
            Bewerken
          </button>
        )}
      </div>
      {sortedProducts.length === 0 ? (
        <p className="text-slate-400">Nog geen producten toegevoegd.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sortedProducts.map((p) => (
            <li key={p.type} className="flex items-center justify-between">
              <span className="text-slate-600">{PRODUCT_TYPE_LABELS[p.type]}</span>
              <span className="text-slate-900">
                {formatAmount(p.amount)} · {p.units} eenh.
              </span>
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
    </div>
  );
}
