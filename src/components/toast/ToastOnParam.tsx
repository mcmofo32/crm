"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/toast/ToastProvider";

/**
 * Voor een actie die bij succes naar een andere pagina doorstuurt (bv. een
 * nieuw aangemaakt record openen) — FormToast/useFormStatus haalt dat niet:
 * de bronpagina (en zijn pending-status) is dan al vervangen vóór de
 * pending->klaar-overgang gezien wordt. De actie voegt in dat geval een
 * query-param toe aan de redirect-URL; dit component leest die param op de
 * bestemmingspagina, toont de melding, en verwijdert de param meteen weer
 * uit de URL (zodat een latere paginaverversing niets opnieuw toont).
 */
export function ToastOnParam({ param, message }: { param: string; message: string }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { showToast } = useToast();
  const hasParam = searchParams.has(param);

  useEffect(() => {
    if (!hasParam) return;
    showToast(message);
    const next = new URLSearchParams(searchParams);
    next.delete(param);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [hasParam, param, message, pathname, router, showToast, searchParams]);

  return null;
}
