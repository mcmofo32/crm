import { ProductType } from "@/generated/prisma/client";

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  PENSIOENSPAREN: "Pensioensparen",
  LANGETERMIJNSPAREN: "Langetermijnsparen",
  BELEGGEN: "Beleggen",
  DELA: "Dela",
  VAPZ: "VAPZ",
  IPT: "IPT",
  KINDERSPAREN: "Kindersparen",
};

/** Vaste, betekenisvolle volgorde waarin producten getoond/ingevuld worden. */
export const PRODUCT_TYPE_ORDER: ProductType[] = [
  "PENSIOENSPAREN",
  "LANGETERMIJNSPAREN",
  "BELEGGEN",
  "DELA",
  "VAPZ",
  "IPT",
  "KINDERSPAREN",
];
