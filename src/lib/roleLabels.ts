import { Role } from "@/generated/prisma/client";

export const ROLE_LABELS: Record<Role, string> = {
  BEHEERDER: "Beheerder",
  ADMIN: "Admin",
  COACH: "Coach",
  USER: "User",
};

export const LEAD_TYPE_LABELS = {
  FA: "Leads FA",
  RG: "Leads RG",
} as const;
