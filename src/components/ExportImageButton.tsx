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

  async function handleClick() {
    const target = document.getElementById(targetId);
    if (!target) return;

    setPending(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(target, {
        backgroundColor: "#ffffff",
        scale: 2,
      });
      const dataUrl = canvas.toDataURL("image/jpeg", 0.95);

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.jpg`;
      link.click();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleClick}
      className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-base font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
    >
      <Camera size={17} />
      {pending ? "Bezig..." : "Exporteren als foto"}
    </button>
  );
}
