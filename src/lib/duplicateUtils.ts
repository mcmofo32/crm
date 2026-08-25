import type { LeadType } from "@/generated/prisma/client";

/**
 * Losstaand van duplicates.ts (een "use server"-bestand, dat enkel async
 * functies mag exporteren) — deze synchrone helpers en types horen hier
 * zodat ze zowel server-side als (indirect) overal anders vrij herbruikt
 * kunnen worden zonder tegen die beperking aan te lopen.
 */

export function normalizeEmail(email: string | null) {
  return email ? email.trim().toLowerCase() : null;
}

export function normalizePhone(phone: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  return digits.length >= 6 ? digits : null;
}

/**
 * Herschrijft een Belgisch mobiel nummer — geschreven als 04xx xx xx xx,
 * +324xx xx xx xx of 324xx xx xx xx, in eender welke spatiëring — naar het
 * vaste formaat "32 4xx xx xx xx". Alles wat niet als zo'n nummer herkend
 * wordt (bv. een nummer dat met +31 begint, of een vast lijn-nummer) blijft
 * exact zoals het is: enkel dit ene, expliciet gevraagde formaat wordt
 * afgedwongen, niets anders.
 */
export function formatBelgianPhone(phone: string | null): string | null {
  if (!phone) return phone;
  const digits = phone.replace(/\D/g, "");

  let subscriber: string;
  if (digits.startsWith("32") && digits.length === 11) {
    subscriber = digits.slice(2);
  } else if (digits.startsWith("0") && digits.length === 10) {
    subscriber = digits.slice(1);
  } else {
    return phone;
  }

  if (!/^4\d{8}$/.test(subscriber)) return phone;

  return `32 ${subscriber.slice(0, 3)} ${subscriber.slice(3, 5)} ${subscriber.slice(5, 7)} ${subscriber.slice(7, 9)}`;
}

export type DuplicateLead = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  leadType: LeadType;
  stageLabel: string;
  ownerId: string;
  ownerName: string;
  createdByName: string;
  createdAt: Date;
};

export type DuplicateGroup = {
  key: string;
  /** Stabiele sleutel (sorted lead-id's) — te gebruiken bij het negeren van deze groep. */
  signature: string;
  sharedEmails: string[];
  sharedPhones: string[];
  leads: DuplicateLead[];
};

export type ContactDuplicateMatch = {
  id: string;
  firstName: string;
  lastName: string;
  ownerName: string;
  matchedOn: "email" | "phone";
};

export type SimpleDuplicateLead = {
  id: string;
  firstName: string;
  lastName: string;
  ownerName: string;
  createdAt: Date;
};

export type SimpleDuplicateGroup = {
  key: string;
  matchLabel: string;
  leads: SimpleDuplicateLead[];
};
