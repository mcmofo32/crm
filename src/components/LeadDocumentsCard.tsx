"use client";

import { useRef, useState, useTransition } from "react";
import { upload } from "@vercel/blob/client";
import { FileText, Upload, Trash2, Eye, Download, X } from "lucide-react";
import {
  saveLeadDocumentAction,
  deleteLeadDocumentAction,
  getLeadDocumentPreviewAction,
  type LeadDocumentPreview,
} from "@/lib/actions/leadDocuments";
import {
  LEAD_DOCUMENT_KIND_ORDER,
  LEAD_DOCUMENT_KIND_LABELS,
  LEAD_DOCUMENT_KIND_HINTS,
  LEAD_DOCUMENT_KIND_ACCEPT,
} from "@/lib/leadDocuments";
import { useToastAction } from "@/components/toast/useToastAction";
import { useToast } from "@/components/toast/ToastProvider";
import type { LeadDocumentKind } from "@/generated/prisma/client";

type DocumentInfo = {
  id: string;
  kind: LeadDocumentKind;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: Date;
  uploadedBy: { name: string };
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * De 3 vaste documentvakken op een klantprofiel (fiche financiële analyse,
 * budgettering, portefeuille) — zelfde Vercel Blob-opslag als Bibliotheek,
 * maar hier per klant hoogstens één bestand per vak, en met "Bekijken" die
 * het document zoveel mogelijk rechtstreeks in de CRM toont i.p.v. enkel
 * downloaden (zie getLeadDocumentPreviewAction).
 */
export function LeadDocumentsCard({
  leadId,
  documents,
  canEdit,
}: {
  leadId: string;
  documents: DocumentInfo[];
  canEdit: boolean;
}) {
  const [preview, setPreview] = useState<{
    kind: LeadDocumentKind;
    data: LeadDocumentPreview;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState<LeadDocumentKind | null>(
    null
  );
  const { showToast } = useToast();

  const byKind = new Map(documents.map((d) => [d.kind, d]));

  async function openPreview(kind: LeadDocumentKind) {
    setPreviewLoading(kind);
    try {
      const data = await getLeadDocumentPreviewAction(leadId, kind);
      if (data.type === "pdf") {
        window.open(data.viewUrl, "_blank", "noopener,noreferrer");
      } else {
        setPreview({ kind, data });
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Kon document niet openen",
        "error"
      );
    } finally {
      setPreviewLoading(null);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <p className="mb-3 font-medium text-slate-900">Documenten</p>
      <div className="flex flex-col gap-3">
        {LEAD_DOCUMENT_KIND_ORDER.map((kind) => (
          <LeadDocumentSlot
            key={kind}
            leadId={leadId}
            kind={kind}
            doc={byKind.get(kind) ?? null}
            canEdit={canEdit}
            onView={() => openPreview(kind)}
            viewing={previewLoading === kind}
          />
        ))}
      </div>

      {preview && (
        <DocumentPreviewModal
          title={LEAD_DOCUMENT_KIND_LABELS[preview.kind]}
          data={preview.data}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}

function LeadDocumentSlot({
  leadId,
  kind,
  doc,
  canEdit,
  onView,
  viewing,
}: {
  leadId: string;
  kind: LeadDocumentKind;
  doc: DocumentInfo | null;
  canEdit: boolean;
  onView: () => void;
  viewing: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const { runWithToast } = useToastAction();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    startTransition(async () => {
      try {
        await runWithToast(async () => {
          let blob;
          try {
            blob = await upload(file.name, file, {
              access: "private",
              handleUploadUrl: "/api/lead-documents/upload",
              clientPayload: JSON.stringify({ leadId, kind }),
            });
          } catch (error) {
            console.error("[lead-document-upload]", error);
            throw error;
          }
          await saveLeadDocumentAction({
            leadId,
            kind,
            fileName: file.name,
            fileUrl: blob.url,
            downloadUrl: blob.downloadUrl,
            blobPathname: blob.pathname,
            mimeType: file.type || "application/octet-stream",
            fileSize: file.size,
          });
        }, doc ? "Document vervangen" : "Document toegevoegd");
      } catch {
        // Foutmelding is al getoond door runWithToast.
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
          {LEAD_DOCUMENT_KIND_LABELS[kind]}
        </span>
        <span className="text-xs text-slate-400">
          {LEAD_DOCUMENT_KIND_HINTS[kind]}
        </span>
      </div>

      {doc ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <FileText size={15} className="flex-shrink-0 text-slate-400" />
            <div className="min-w-0">
              <p
                className="truncate font-medium text-slate-900"
                title={doc.fileName}
              >
                {doc.fileName}
              </p>
              <p className="text-xs text-slate-400">
                {formatFileSize(doc.fileSize)} · {doc.uploadedBy.name}
              </p>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <button
              type="button"
              disabled={viewing}
              onClick={onView}
              title="Bekijken in de CRM"
              className="flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <Eye size={13} />
              {viewing ? "…" : "Bekijken"}
            </button>
            <a
              href={`/api/lead-documents/${doc.id}?download=1`}
              title="Downloaden"
              className="flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Download size={13} />
            </a>
            {canEdit && (
              <button
                type="button"
                disabled={pending}
                title="Verwijderen"
                onClick={() => {
                  if (!confirm(`"${doc.fileName}" verwijderen?`)) return;
                  startTransition(async () => {
                    await runWithToast(
                      () => deleteLeadDocumentAction(leadId, kind),
                      "Verwijderd"
                    );
                  });
                }}
                className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="text-slate-400">Nog geen bestand toegevoegd.</p>
      )}

      {canEdit && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept={LEAD_DOCUMENT_KIND_ACCEPT[kind]}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
            className="hidden"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => fileInputRef.current?.click()}
            className="flex w-fit items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <Upload size={13} />
            {pending ? "Bezig…" : doc ? "Vervangen" : "Uploaden"}
          </button>
        </>
      )}
    </div>
  );
}

function DocumentPreviewModal({
  title,
  data,
  onClose,
}: {
  title: string;
  data: LeadDocumentPreview;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <p className="font-medium text-slate-900">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-auto p-4">
          {data.type === "html" && (
            <div
              className="lead-document-preview"
              dangerouslySetInnerHTML={{ __html: data.html }}
            />
          )}
          {data.type === "unsupported" && (
            <p className="text-sm text-slate-500">{data.reason}</p>
          )}
          {data.type === "pdf" && (
            <p className="text-sm text-slate-500">
              Dit bestand wordt in een nieuw tabblad geopend.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
