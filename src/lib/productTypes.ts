import { ProductType } from "@/generated/prisma/client";

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  PENSIOENSPAREN: "Pensioensparen",
  LANGETERMIJNSPAREN: "Langetermijnsparen",
  BELEGGEN: "Beleggen",
  NZP: "NZP",
  UZP: "UZP",
  VAPZ: "VAPZ",
  IPT: "IPT",
  KINDERSPAREN: "Kindersparen",
};

/** Vaste, betekenisvolle volgorde waarin producten getoond/ingevuld worden. */
export const PRODUCT_TYPE_ORDER: ProductType[] = [
  "PENSIOENSPAREN",
  "LANGETERMIJNSPAREN",
  "BELEGGEN",
  "NZP",
  "UZP",
  "VAPZ",
  "IPT",
  "KINDERSPAREN",
];
