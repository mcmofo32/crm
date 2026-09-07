import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, Download, FileText, Folder } from "lucide-react";
import { getEffectiveViewer } from "@/lib/impersonation";
import {
  canViewBeheerderTools,
  canViewManagementLibrary,
  canViewSubagentLibrary,
} from "@/lib/permissions";
import {
  getLibraryTabs,
  getLibraryDocuments,
  createLibraryTabAction,
  deleteLibraryTabAction,
  createLibraryCategoryAction,
  deleteLibraryCategoryAction,
} from "@/lib/actions/library";
import { LibrarySection } from "@/generated/prisma/client";
import { UploadLibraryDocumentForm } from "@/components/UploadLibraryDocumentForm";
import { DeleteLibraryDocumentButton } from "@/components/DeleteLibraryDocumentButton";
import { DeleteLibraryEntryButton } from "@/components/DeleteLibraryEntryButton";
import { AddLibraryEntryForm } from "@/components/AddLibraryEntryForm";

// Nooit cachen/statisch renderen — net toegevoegde of verwijderde documenten
// moeten meteen zichtbaar zijn.
export const dynamic = "force-dynamic";

const SECTION_LABELS: Record<LibrarySection, string> = {
  ALGEMEEN: "Bestanden",
  MANAGEMENT: "Management",
  SUBAGENT: "Subagent",
};

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

export default async function BibliotheekPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; tab?: string; category?: string }>;
}) {
  const viewer = await getEffectiveViewer();
  if (!viewer) redirect("/login");

  const canManage = canViewBeheerderTools(viewer);
  const { section: sectionParam, tab: tabParam, category: categoryParam } =
    await searchParams;

  const availableSections: LibrarySection[] = [LibrarySection.ALGEMEEN];
  if (canViewManagementLibrary(viewer)) availableSections.push(LibrarySection.MANAGEMENT);
  if (canViewSubagentLibrary(viewer)) availableSections.push(LibrarySection.SUBAGENT);

  const section = availableSections.includes(sectionParam as LibrarySection)
    ? (sectionParam as LibrarySection)
    : LibrarySection.ALGEMEEN;

  const tabs = await getLibraryTabs(section);
  const activeTab = tabs.find((t) => t.id === tabParam) ?? tabs[0] ?? null;
  const activeCategory = activeTab?.categories.find((c) => c.id === categoryParam) ?? null;

  const categoryIds = activeCategory
    ? [activeCategory.id]
    : activeTab
    ? activeTab.categories.map((c) => c.id)
    : [];
  const documents = await getLibraryDocuments(categoryIds);

  function sectionHref(s: LibrarySection) {
    return `/bibliotheek?section=${s}`;
  }
  function tabHref(tabId: string) {
    return `/bibliotheek?section=${section}&tab=${tabId}`;
  }
  function categoryHref(tabId: string, categoryId?: string) {
    const params = new URLSearchParams({ section, tab: tabId });
    if (categoryId) params.set("category", categoryId);
    return `/bibliotheek?${params.toString()}`;
  }

  const boundCreateTab = createLibraryTabAction.bind(null, section);

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

      {availableSections.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {availableSections.map((s) => (
            <Link
              key={s}
              href={sectionHref(s)}
              className={`rounded-md px-4 py-2 text-sm font-medium ${
                s === section
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {SECTION_LABELS[s]}
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between gap-1 px-1">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Mappenstructuur
            </h2>
            {canManage && (
              <AddLibraryEntryForm
                action={boundCreateTab}
                placeholder="Naam map"
                successMessage="Map toegevoegd"
              />
            )}
          </div>

          {tabs.length === 0 ? (
            <p className="px-1 py-2 text-sm text-slate-400">Nog geen mappen.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {tabs.map((tab) => (
                <div key={tab.id}>
                  <div className="flex items-center justify-between gap-1 px-1">
                    <Link
                      href={tabHref(tab.id)}
                      className={`truncate text-sm font-medium ${
                        tab.id === activeTab?.id
                          ? "text-slate-900"
                          : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      {tab.name}
                    </Link>
                    {canManage && (
                      <DeleteLibraryEntryButton
                        confirmMessage={`"${tab.name}" verwijderen?`}
                        successMessage="Verwijderd"
                        action={deleteLibraryTabAction.bind(null, tab.id)}
                      />
                    )}
                  </div>
                  <div className="ml-1 mt-1 flex flex-col gap-0.5 border-l border-slate-100 pl-3">
                    {tab.categories.map((category) => (
                      <div key={category.id} className="flex items-center justify-between gap-1">
                        <Link
                          href={categoryHref(tab.id, category.id)}
                          className={`flex min-w-0 flex-1 items-center gap-1.5 truncate rounded px-1.5 py-1 text-sm ${
                            category.id === activeCategory?.id
                              ? "bg-slate-900 text-white"
                              : "text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <Folder size={13} className="flex-shrink-0" />
                          <span className="truncate">{category.name}</span>
                        </Link>
                        {canManage && (
                          <DeleteLibraryEntryButton
                            confirmMessage={`"${category.name}" verwijderen?`}
                            successMessage="Verwijderd"
                            action={deleteLibraryCategoryAction.bind(null, category.id)}
                          />
                        )}
                      </div>
                    ))}
                    {canManage && (
                      <div className="px-0.5 py-1">
                        <AddLibraryEntryForm
                          action={createLibraryCategoryAction.bind(null, tab.id)}
                          placeholder="Naam categorie"
                          successMessage="Categorie toegevoegd"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {canManage &&
            (activeTab ? (
              <UploadLibraryDocumentForm tabs={tabs} defaultCategoryId={activeCategory?.id} />
            ) : (
              <p className="rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500">
                Maak eerst een map aan om documenten te kunnen uploaden.
              </p>
            ))}

          {documents.length === 0 ? (
            <p className="text-base text-slate-500">Nog geen documenten toegevoegd.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Bestand</th>
                    <th className="px-4 py-2.5 font-medium">Grootte</th>
                    <th className="px-4 py-2.5 font-medium">Datum</th>
                    <th className="px-4 py-2.5 font-medium text-right">Actie</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {documents.map((doc) => (
                    <tr key={doc.id}>
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                            <FileText size={15} />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">{doc.title}</p>
                            <p className="truncate text-xs text-slate-400">
                              {doc.uploadedBy.name}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                        {formatFileSize(doc.fileSize)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                        {formatDate(doc.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={`/api/library/download/${doc.id}`}
                            className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <Download size={14} />
                            Downloaden
                          </a>
                          {canManage && (
                            <DeleteLibraryDocumentButton documentId={doc.id} title={doc.title} />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
