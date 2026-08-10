import { EventType } from "@/generated/prisma/client";

/**
 * Evenementtypes waarvan de aanwezigheid achteraf door Beheerder/Admin
 * bevestigd wordt, en die daardoor meetellen voor een jaarlijkse KPI op het
 * dashboard (KPI Seminarie resp. KPI Belsessie).
 */
export const VERIFIABLE_EVENT_TYPES: EventType[] = ["SEMINAR", "BELSESSIE"];
