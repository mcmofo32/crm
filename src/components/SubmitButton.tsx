"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

/**
 * Submit-knop die zichzelf uitschakelt zolang de omvattende form-actie nog
 * loopt — voorkomt dat een trage respons (of een ongeduldige dubbele klik)
 * de actie twee keer laat uitvoeren, met dubbele records tot gevolg.
 */
export function SubmitButton({
  children,
  disabled,
  className,
}: {
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className={className}>
      {children}
    </button>
  );
}
