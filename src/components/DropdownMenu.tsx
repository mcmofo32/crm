"use client";

import { useRef, type ReactNode } from "react";

/**
 * Klikbaar uitklapmenu (native <details>) dat zichzelf sluit zodra er ergens
 * binnenin geklikt wordt — bv. na het volgen van een link in het menu.
 */
export function DropdownMenu({
  trigger,
  children,
}: {
  trigger: ReactNode;
  children: ReactNode;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  return (
    <details ref={detailsRef} className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-1 py-1 hover:bg-slate-100 [&::-webkit-details-marker]:hidden">
        {trigger}
      </summary>
      <div
        onClick={() => {
          if (detailsRef.current) detailsRef.current.open = false;
        }}
        className="absolute right-0 z-50 mt-2 w-60 rounded-md border border-slate-200 bg-white p-1.5 shadow-lg"
      >
        {children}
      </div>
    </details>
  );
}
