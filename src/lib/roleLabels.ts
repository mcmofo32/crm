import { Role, LeadType, LeadStatus } from "@/generated/prisma/client";
import type { BadgeVariant } from "@/components/Badge";

export const ROLE_LABELS: Record<Role, string> = {
  BEHEERDER: "Beheerder",
  ADMIN: "Admin",
  COACH: "Coach",
  USER: "User",
};

export const ROLE_BADGE_VARIANT: Record<Role, BadgeVariant> = {
  BEHEERDER: "purple",
  ADMIN: "blue",
  COACH: "amber",
  USER: "slate",
};

export const LEAD_TYPE_LABELS = {
  FA: "Leads FA",
  RG: "Leads RG",
} as const;

export const LEAD_TYPE_BADGE_VARIANT = {
  FA: "blue",
  RG: "purple",
} as const satisfies Record<string, BadgeVariant>;

const LEAD_STATUS_LABELS_BY_TYPE: Record<LeadType, Record<LeadStatus, string>> = {
  FA: { OPEN: "Open", WON: "Klant", LOST: "Verloren" },
  RG: { OPEN: "Open", WON: "Medewerker", LOST: "Verloren" },
};

export function leadStatusLabel(status: LeadStatus, leadType: LeadType) {
  return LEAD_STATUS_LABELS_BY_TYPE[leadType][status];
}

export const LEAD_STATUS_BADGE_VARIANT = {
  OPEN: "slate",
  WON: "green",
  LOST: "red",
} as const satisfies Record<string, BadgeVariant>;
