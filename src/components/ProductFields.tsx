"use client";

import { PRODUCT_TYPE_ORDER, PRODUCT_TYPE_LABELS } from "@/lib/productTypes";
import type { ProductType } from "@/generated/prisma/client";

export type ProductsState = Partial<Record<ProductType, { amount: string; units: string }>>;

export function emptyProductsState(): ProductsState {
  return {};
}

export function hasAnyProduct(value: ProductsState): boolean {
  return PRODUCT_TYPE_ORDER.some((type) => (value[type]?.amount ?? "").trim() !== "");
}

export function buildProductsFormData(value: ProductsState): FormData {
  const formData = new FormData();
  for (const type of PRODUCT_TYPE_ORDER) {
    formData.set(`amount-${type}`, value[type]?.amount ?? "");
    formData.set(`units-${type}`, value[type]?.units ?? "");
  }
  return formData;
}

export function ProductFields({
  value,
  onChange,
}: {
  value: ProductsState;
  onChange: (next: ProductsState) => void;
}) {
  function setField(type: ProductType, field: "amount" | "units", raw: string) {
    onChange({
      ...value,
      [type]: {
        amount: field === "amount" ? raw : value[type]?.amount ?? "",
        units: field === "units" ? raw : value[type]?.units ?? "",
      },
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-slate-700">Producten</p>
      <div className="grid grid-cols-[1fr_7rem_6rem] items-center gap-x-2 gap-y-1.5 text-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Product
        </span>
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Bedrag (€)
        </span>
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Eenheden
        </span>
        {PRODUCT_TYPE_ORDER.map((type) => (
          <div key={type} className="contents">
            <span className="text-slate-600">{PRODUCT_TYPE_LABELS[type]}</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={value[type]?.amount ?? ""}
              onChange={(e) => setField(type, "amount", e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1.5"
            />
            <input
              type="number"
              min={0}
              step="1"
              value={value[type]?.units ?? ""}
              onChange={(e) => setField(type, "units", e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1.5"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
