"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { useToast } from "@/components/toast/ToastProvider";

/**
 * Drop dit ergens in een bestaand `<form action={...}>` om na een geslaagde
 * indiening een korte melding te tonen — geen wijziging aan de actie zelf
 * nodig. Vuurt enkel bij succes: gooit de actie een fout, dan vervangt de
 * dichtstbijzijnde error-boundary (zie app/error.tsx) deze component (en dus
 * ook dit effect) nog vóór de pending->klaar-overgang hier gezien wordt.
 */
export function FormToast({ message = "Opgeslagen" }: { message?: string }) {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (wasPending.current && !pending) {
      showToast(message);
    }
    wasPending.current = pending;
  }, [pending, message, showToast]);

  return null;
}
