import { redirect } from "next/navigation";
import { BookOpen, Download, FileText } from "lucide-react";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canViewBeheerderTools } from "@/lib/permissions";
import { getLibraryDocuments } from "@/lib/actions/library";
import { UploadLibraryDocumentForm } from "@/components/UploadLibraryDocumentForm";
import { DeleteLibraryDocumentButton } from "@/components/DeleteLibraryDocumentButton";

// Nooit cachen/statisch renderen — net toegevoegde of verwijderde documenten
// moeten meteen zichtbaar zijn.
export const dynamic = "force-dynamic";

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: Date) {
  return date.toLocaleDateString("nl-BE", {
    dateStyle: "medium",
    timeZone: "Europe/Brussels",
  });
}

export default async function BibliotheekPage() {
  const viewer = await getEffectiveViewer();
  if (!viewer) redirect("/login");

  const canManage = canViewBeheerderTools(viewer);
  const documents = await getLibraryDocuments();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900">
          <BookOpen size={26} />
          Bibliotheek
        </h1>
        <p className="mt-1 text-base text-slate-500">
          Documenten, presentaties en cursusmateriaal om te raadplegen of te
          downloaden.
        </p>
      </div>

      {canManage && <UploadLibraryDocumentForm />}

      {documents.length === 0 ? (
        <p className="text-base text-slate-500">Nog geen documenten toegevoegd.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <ul className="divide-y divide-slate-100">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <FileText size={17} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{doc.title}</p>
                    <p className="truncate text-xs text-slate-400">
                      {doc.uploadedBy.name} · {formatDate(doc.createdAt)} ·{" "}
                      {formatFileSize(doc.fileSize)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <a
                    href={doc.downloadUrl}
                    className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Download size={14} />
                    Downloaden
                  </a>
                  {canManage && (
                    <DeleteLibraryDocumentButton documentId={doc.id} title={doc.title} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
