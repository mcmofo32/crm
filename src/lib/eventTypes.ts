import { EventType, AttendanceStatus } from "@/generated/prisma/client";

/**
 * Evenementtypes waarvan de aanwezigheid achteraf door Beheerder/Admin
 * bevestigd wordt, en die daardoor meetellen voor een jaarlijkse KPI op het
 * dashboard (KPI Seminarie resp. KPI Belsessie).
 */
export const VERIFIABLE_EVENT_TYPES: EventType[] = ["SEMINAR", "BELSESSIE"];

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  PENDING: "Nog niet gereageerd",
  GOING: "Aanwezig",
  NOT_GOING: "Niet aanwezig",
};
