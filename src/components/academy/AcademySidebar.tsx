"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";

type TocItem = { id: string; num: string; title: string };

export function AcademySidebar({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");
  const [mobileOpen, setMobileOpen] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const sections = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Neem de hoogst-op-de-pagina zichtbare sectie als actief — stabieler
        // dan "eerste intersecting entry" bij snel scrollen over meerdere
        // korte hoofdstukken tegelijk.
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        const top = visible.reduce((a, b) =>
          a.boundingClientRect.top < b.boundingClientRect.top ? a : b
        );
        setActiveId(top.target.id);
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 }
    );

    sections.forEach((el) => observerRef.current?.observe(el));
    return () => observerRef.current?.disconnect();
  }, [items]);

  const tocList = (
    <ul className="space-y-0.5">
      {items.map((item) => (
        <li key={item.id}>
          <a
            href={`#${item.id}`}
            onClick={() => setMobileOpen(false)}
            className={`flex items-baseline gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
              activeId === item.id
                ? "bg-slate-900 font-medium text-white dark:bg-slate-100 dark:text-slate-900"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            }`}
          >
            <span
              className={`text-xs tabular-nums ${
                activeId === item.id ? "text-slate-300 dark:text-slate-600" : "text-slate-400 dark:text-slate-500"
              }`}
            >
              {item.num}
            </span>
            <span className="min-w-0">{item.title}</span>
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      {/* Mobiel: knop + uitklappaneel — zelfde patroon als NavLinks.tsx */}
      <div className="mb-4 flex items-center justify-between lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
        >
          {mobileOpen ? <X size={16} /> : <Menu size={16} />}
          Inhoudstafel
        </button>
      </div>
      {mobileOpen && (
        <nav className="mb-4 rounded-lg border border-slate-200 bg-white p-3 lg:hidden dark:border-slate-800 dark:bg-slate-900">
          {tocList}
        </nav>
      )}

      <nav className="sticky top-4 hidden max-h-[calc(100vh-2rem)] overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 lg:block dark:border-slate-800 dark:bg-slate-900">
        <p className="mb-2 px-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Inhoud
        </p>
        {tocList}
        <Link
          href="#top"
          className="mt-2 block px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
        >
          ↑ Naar boven
        </Link>
      </nav>
    </>
  );
}
