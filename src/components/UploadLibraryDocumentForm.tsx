"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { upload } from "@vercel/blob/client";
import { Upload, FileText } from "lucide-react";
import { saveLibraryDocumentAction } from "@/lib/actions/library";
import { useToastAction } from "@/components/toast/useToastAction";

type LibraryTabOption = {
  id: string;
  name: string;
  categories: { id: string; name: string }[];
};

/**
 * Het bestand zelf gaat rechtstreeks van de browser naar Vercel Blob (via
 * /api/library/upload, dat enkel een upload-token uitgeeft) — nooit door
 * een server-actie, zodat ook grote presentaties/cursusbestanden werken.
 * Pas nadien slaat saveLibraryDocumentAction de metadata (naam + URL's) op.
 */
export function UploadLibraryDocumentForm({
  tabs,
  defaultCategoryId,
}: {
  tabs: LibraryTabOption[];
  defaultCategoryId?: string;
}) {
  const firstCategoryId = tabs.flatMap((t) => t.categories)[0]?.id ?? "";
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? firstCategoryId);
  const [inputKey, setInputKey] = useState(0);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { runWithToast } = useToastAction();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file || !categoryId) return;
    const currentFile = file;
    const currentTitle = title;
    const currentCategoryId = categoryId;

    startTransition(async () => {
      try {
        await runWithToast(async () => {
          // Geen onUploadProgress: dat dwingt @vercel/blob/client in een
          // streaming-uploadpad (body als ReadableStream, fetch met
          // duplex:"half") dat afhankelijk is van fragiele, browserspecifieke
          // feature-detectie — en dat pad lijkt de "Failed to execute
          // 'fetch' on 'Window': Invalid value"-fout te veroorzaken. Zonder
          // voortgangsindicatie gebruikt de bibliotheek een simpele,
          // rechttoe-rechtaan fetch() met het bestand als gewone body.
          let blob;
          try {
            blob = await upload(currentFile.name, currentFile, {
              access: "public",
              handleUploadUrl: "/api/library/upload",
            });
          } catch (error) {
            // Zichtbaar in de browserconsole (F12), i.t.t. de generieke
            // toast-melding die enkel error.message toont.
            console.error("[bibliotheek-upload]", error);
            throw error;
          }

          await saveLibraryDocumentAction({
            title: currentTitle,
            fileName: currentFile.name,
            fileUrl: blob.url,
            downloadUrl: blob.downloadUrl,
            blobPathname: blob.pathname,
            mimeType: currentFile.type || "application/octet-stream",
            fileSize: currentFile.size,
            categoryId: currentCategoryId,
          });
        }, "Document toegevoegd");

        setTitle("");
        setFile(null);
        setInputKey((k) => k + 1);
      } catch {
        // Foutmelding is al getoond door runWithToast.
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
        <label className="text-sm font-medium text-slate-700">Categorie</label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {tabs.map((tab) => (
            <optgroup key={tab.id} label={tab.name}>
              {tab.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700">Bestand</label>
        <input
          key={inputKey}
          ref={fileInputRef}
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex max-w-xs items-center gap-1.5 truncate rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          <FileText size={14} className="flex-shrink-0" />
          <span className="truncate">{file ? file.name : "Kies een bestand..."}</span>
        </button>
      </div>
      <button
        type="submit"
        disabled={pending || !file || !categoryId}
        className="flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        <Upload size={15} />
        {pending ? "Uploaden..." : "Toevoegen"}
      </button>
    </form>
  );
}
