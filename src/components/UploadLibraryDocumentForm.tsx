"use client";

import { useState, useTransition, type FormEvent } from "react";
import { upload } from "@vercel/blob/client";
import { Upload } from "lucide-react";
import { saveLibraryDocumentAction } from "@/lib/actions/library";
import { useToastAction } from "@/components/toast/useToastAction";

/**
 * Het bestand zelf gaat rechtstreeks van de browser naar Vercel Blob (via
 * /api/library/upload, dat enkel een upload-token uitgeeft) — nooit door
 * een server-actie, zodat ook grote presentaties/cursusbestanden werken.
 * Pas nadien slaat saveLibraryDocumentAction de metadata (naam + URL's) op.
 */
export function UploadLibraryDocumentForm() {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [pending, startTransition] = useTransition();
  const { runWithToast } = useToastAction();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    const currentFile = file;
    const currentTitle = title;

    startTransition(async () => {
      try {
        await runWithToast(async () => {
          const blob = await upload(currentFile.name, currentFile, {
            access: "public",
            handleUploadUrl: "/api/library/upload",
            onUploadProgress: ({ percentage }) => setProgress(percentage),
          });

          await saveLibraryDocumentAction({
            title: currentTitle,
            fileName: currentFile.name,
            fileUrl: blob.url,
            downloadUrl: blob.downloadUrl,
            blobPathname: blob.pathname,
            mimeType: currentFile.type || "application/octet-stream",
            fileSize: currentFile.size,
          });
        }, "Document toegevoegd");

        setTitle("");
        setFile(null);
        setInputKey((k) => k + 1);
      } catch {
        // Foutmelding is al getoond door runWithToast.
      } finally {
        setProgress(null);
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4"
    >
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700">Naam</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Bv. Opleiding levensverzekeringen"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700">Bestand</label>
        <input
          key={inputKey}
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          required
          className="text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending || !file}
        className="flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        <Upload size={15} />
        {pending ? (progress != null ? `Uploaden... ${progress}%` : "Uploaden...") : "Toevoegen"}
      </button>
    </form>
  );
}
