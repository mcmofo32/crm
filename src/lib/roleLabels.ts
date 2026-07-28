import { Role } from "@/generated/prisma/client";
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

export const LEAD_STATUS_LABELS = {
  OPEN: "Open",
  WON: "Gewonnen",
  LOST: "Verloren",
} as const;

export const LEAD_STATUS_BADGE_VARIANT = {
  OPEN: "slate",
  WON: "green",
  LOST: "red",
} as const satisfies Record<string, BadgeVariant>;
