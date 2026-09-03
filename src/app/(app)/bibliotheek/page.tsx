import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, Download, FileText } from "lucide-react";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canViewBeheerderTools } from "@/lib/permissions";
import {
  getLibraryTabs,
  getLibraryDocuments,
  createLibraryTabAction,
  deleteLibraryTabAction,
  createLibraryCategoryAction,
  deleteLibraryCategoryAction,
} from "@/lib/actions/library";
import { UploadLibraryDocumentForm } from "@/components/UploadLibraryDocumentForm";
import { DeleteLibraryDocumentButton } from "@/components/DeleteLibraryDocumentButton";
import { DeleteLibraryEntryButton } from "@/components/DeleteLibraryEntryButton";
import { AddLibraryEntryForm } from "@/components/AddLibraryEntryForm";

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

/** Eén klikbare pil (tabblad of categorie), met optioneel een verwijderknopje ernaast. */
function LibraryPill({
  href,
  label,
  active,
  canManage,
  onDelete,
}: {
  href: string;
  label: string;
  active: boolean;
  canManage: boolean;
  onDelete?: () => Promise<void>;
}) {
  return (
    <div
      className={`flex items-center gap-1 rounded-full py-1 text-sm font-medium ${
        canManage && onDelete ? "pl-3.5 pr-1.5" : "px-3.5"
      } ${
        active
          ? "bg-slate-900 text-white"
          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      <Link href={href}>{label}</Link>
      {canManage && onDelete && (
        <DeleteLibraryEntryButton
          confirmMessage={`"${label}" verwijderen?`}
          successMessage="Verwijderd"
          action={onDelete}
        />
      )}
    </div>
  );
}

export default async function BibliotheekPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; category?: string }>;
}) {
  const viewer = await getEffectiveViewer();
  if (!viewer) redirect("/login");

  const canManage = canViewBeheerderTools(viewer);
  const { tab: tabParam, category: categoryParam } = await searchParams;

  const tabs = await getLibraryTabs();
  const activeTab = tabs.find((t) => t.id === tabParam) ?? tabs[0] ?? null;
  const activeCategory = activeTab?.categories.find((c) => c.id === categoryParam) ?? null;

  const categoryIds = activeCategory
    ? [activeCategory.id]
    : activeTab
    ? activeTab.categories.map((c) => c.id)
    : [];
  const documents = await getLibraryDocuments(categoryIds);

  function tabHref(tabId: string) {
    return `/bibliotheek?tab=${tabId}`;
  }
  function categoryHref(tabId: string, categoryId?: string) {
    const params = new URLSearchParams({ tab: tabId });
    if (categoryId) params.set("category", categoryId);
    return `/bibliotheek?${params.toString()}`;
  }

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

      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((tab) => (
          <LibraryPill
            key={tab.id}
            href={tabHref(tab.id)}
            label={tab.name}
            active={tab.id === activeTab?.id}
            canManage={canManage}
            onDelete={deleteLibraryTabAction.bind(null, tab.id)}
          />
        ))}
        {canManage && (
          <AddLibraryEntryForm
            action={createLibraryTabAction}
            placeholder="Naam tabblad"
            successMessage="Tabblad toegevoegd"
          />
        )}
      </div>

      {activeTab ? (
        <>
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4">
            <LibraryPill
              href={tabHref(activeTab.id)}
              label="Alle"
              active={!activeCategory}
              canManage={false}
            />
            {activeTab.categories.map((category) => (
              <LibraryPill
                key={category.id}
                href={categoryHref(activeTab.id, category.id)}
                label={category.name}
                active={category.id === activeCategory?.id}
                canManage={canManage}
                onDelete={deleteLibraryCategoryAction.bind(null, category.id)}
              />
            ))}
            {canManage && (
              <AddLibraryEntryForm
                action={createLibraryCategoryAction.bind(null, activeTab.id)}
                placeholder="Naam categorie"
                successMessage="Categorie toegevoegd"
              />
            )}
          </div>

          {canManage &&
            (activeTab.categories.length > 0 ? (
              <UploadLibraryDocumentForm tabs={tabs} defaultCategoryId={activeCategory?.id} />
            ) : (
              <p className="rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500">
                Voeg eerst een categorie toe aan dit tabblad om documenten te
                kunnen uploaden.
              </p>
            ))}

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
        </>
      ) : canManage ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500">
          Maak hierboven een eerste tabblad aan (bv. &quot;Opleiding&quot; of
          &quot;Documenten&quot;) om te beginnen.
        </p>
      ) : (
        <p className="text-base text-slate-500">Nog geen documenten toegevoegd.</p>
      )}
    </div>
  );
}
