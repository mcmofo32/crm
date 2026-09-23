import { EventType, AttendanceStatus } from "@/generated/prisma/client";
import type { BadgeVariant } from "@/components/Badge";

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  MEETING: "Vergadering",
  SEMINAR: "Seminarie",
  BELSESSIE: "Belsessie",
  MANAGEMENTMEETING: "Managementmeeting",
  STRUCTUURMEETING: "Structuur meeting",
  OPLEIDING: "Opleiding",
};

export const EVENT_TYPE_BADGE_VARIANTS: Record<EventType, BadgeVariant> = {
  MEETING: "blue",
  SEMINAR: "purple",
  BELSESSIE: "green",
  MANAGEMENTMEETING: "amber",
  STRUCTUURMEETING: "slate",
  OPLEIDING: "red",
};

export const EVENT_TYPES: EventType[] = Object.keys(EVENT_TYPE_LABELS) as EventType[];

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
