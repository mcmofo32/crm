"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

/**
 * Vangt fouten op die een server-actie gooit (bv. validatie- of
 * rechtencontroles) zodat de effectieve foutmelding zichtbaar wordt i.p.v.
 * de generieke Next.js-foutpagina zonder uitleg.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-lg border border-red-200 bg-red-50 p-8 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
        <AlertTriangle size={22} />
      </span>
      <div>
        <h1 className="text-lg font-semibold text-red-800">
          Er ging iets mis
        </h1>
        <p className="mt-1 text-sm text-red-700">
          {error.message || "Onbekende fout. Probeer het opnieuw."}
        </p>
      </div>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Probeer opnieuw
      </button>
    </div>
  );
}
