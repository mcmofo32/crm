"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Klikbaar uitklapmenu (native <details>) dat zichzelf sluit zodra er ergens
 * binnenin geklikt wordt — bv. na het volgen van een link in het menu — of
 * ergens buiten het menu, zonder dat een <details> dat uit zichzelf doet.
 */
export function DropdownMenu({
  trigger,
  children,
}: {
  trigger: ReactNode;
  children: ReactNode;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const details = detailsRef.current;
      if (details?.open && !details.contains(e.target as Node)) {
        details.open = false;
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <details ref={detailsRef} className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-1 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 [&::-webkit-details-marker]:hidden">
        {trigger}
      </summary>
      <div
        onClick={() => {
          if (detailsRef.current) detailsRef.current.open = false;
        }}
        className="absolute right-0 z-50 mt-2 w-60 rounded-md border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-800"
      >
        {children}
      </div>
    </details>
  );
}
