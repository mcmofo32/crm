"use client";

import { useState } from "react";
import { Camera } from "lucide-react";

/** Legt de inhoud van het element met `targetId` vast als JPEG en downloadt die meteen. */
export function ExportImageButton({
  targetId,
  filename,
}: {
  targetId: string;
  filename: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    const target = document.getElementById(targetId);
    if (!target) return;

    setPending(true);
    setError(null);
    try {
      // html-to-image i.p.v. html2canvas: die laatste kan geen moderne
      // CSS-kleurfuncties (oklch(), zoals Tailwind v4 die overal gebruikt)
      // parsen en faalt daardoor stil op deze tabellen.
      const { toJpeg } = await import("html-to-image");
      const dataUrl = await toJpeg(target, {
        quality: 0.95,
        backgroundColor: "#ffffff",
        pixelRatio: 2,
      });

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.jpg`;
      link.click();
    } catch (err) {
      setError("Exporteren mislukt. Probeer opnieuw.");
      console.error(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={handleClick}
        className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-base font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        <Camera size={17} />
        {pending ? "Bezig..." : "Exporteren als foto"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
