import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { getEffectiveViewer } from "@/lib/impersonation";
import { AcademyBlocks } from "@/components/academy/AcademyBlocks";
import { AcademySidebar } from "@/components/academy/AcademySidebar";
import academyContent from "@/lib/academy-content.json";
import type { AcademyContent } from "@/lib/academy-types";

export const metadata = { title: "Academy — Structuur A" };

const content = academyContent as AcademyContent;

export default async function AcademyPage() {
  const viewer = await getEffectiveViewer();
  if (!viewer) redirect("/login");

  const { chapters } = content;
  const tocItems = chapters.map((ch) => ({ id: ch.id, num: ch.num, title: ch.title }));
  const totalPhotos = chapters.reduce(
    (n, ch) => n + ch.blocks.filter((b) => b[0] === "photo").length,
    0
  );

  return (
    <div id="top" className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
      <div>
        <AcademySidebar items={tocItems} />
      </div>

      <div className="min-w-0 space-y-10">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900 dark:text-slate-100">
            <GraduationCap size={26} />
            {content.courseTitle}
          </h1>
          <p className="mt-1 max-w-2xl text-base text-slate-500 dark:text-slate-400">
            {content.courseSubtitle}.
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400 dark:text-slate-500">
            <span>{chapters.length} hoofdstukken</span>
            <span>·</span>
            <span>{totalPhotos} echte screenshots uit het CRM</span>
          </div>
        </div>

        {chapters.map((ch) => (
          <section key={ch.id} id={ch.id} className="scroll-mt-20 border-t border-slate-200 pt-8 dark:border-slate-800">
            <div className="mb-4 flex items-start gap-3">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-sm font-semibold tabular-nums text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                {ch.num}
              </span>
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{ch.title}</h2>
                {ch.audience && (
                  <p className="mt-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">{ch.audience}</p>
                )}
              </div>
            </div>
            <AcademyBlocks blocks={ch.blocks} />
          </section>
        ))}

        <div className="border-t border-slate-200 pt-6 text-sm text-slate-400 dark:border-slate-800 dark:text-slate-500">
          Voor een offline/afdrukbare versie: zie de{" "}
          <Link href="/bibliotheek" className="text-slate-600 underline hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
            Bibliotheek
          </Link>
          .
        </div>
      </div>
    </div>
  );
}
