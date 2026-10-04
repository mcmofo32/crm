"use client";

import { useEffect, useState } from "react";
import { Play, X } from "lucide-react";

/**
 * "Bekijken"-knop voor een Bibliotheek-video: speelt af in een venster in de
 * CRM zelf, zonder downloadmogelijkheid. Het bestand komt enkel binnen via
 * /api/library/stream/[id] (met toegangscontrole), de downloadknop van de
 * speler en het rechtermuisklikmenu zijn uitgeschakeld.
 */
export function LibraryVideoButton({ documentId, title }: { documentId: string; title: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Play size={14} />
        Bekijken
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-4xl rounded-lg bg-white p-4 shadow-xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="truncate text-base font-medium text-slate-900 dark:text-slate-100">{title}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                <X size={16} />
              </button>
            </div>
            <video
              src={`/api/library/stream/${documentId}`}
              controls
              autoPlay
              playsInline
              controlsList="nodownload noremoteplayback"
              disablePictureInPicture
              onContextMenu={(e) => e.preventDefault()}
              className="max-h-[75vh] w-full rounded-md bg-black"
            />
          </div>
        </div>
      )}
    </>
  );
}
