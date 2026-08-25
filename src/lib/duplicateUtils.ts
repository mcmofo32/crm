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
