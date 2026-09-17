"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  ListChecks,
  TrendingUp,
  Trophy,
  UserCheck,
  CalendarDays,
  Network,
  LineChart,
  BookOpen,
  ChevronDown,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/pipeline/verkoop": Users,
  "/taken": ListChecks,
  "/funnel/FA": TrendingUp,
  "/klanten": UserCheck,
  "/incentives": Trophy,
  "/evenementen": CalendarDays,
  "/organigram": Network,
  "/productie": LineChart,
  "/bibliotheek": BookOpen,
};

type NavItem = {
  href: string;
  label: string;
  badge?: number;
  /** Toont enkel het icoon op een smaller desktopscherm (vanaf lg: ook de tekst) — voor een item dat pas laat toegevoegd is en anders de balk te vol maakt. */
  compactLabel?: boolean;
  children?: { href: string; label: string }[];
};

function isNavItemActive(item: NavItem, pathname: string) {
  return (
    pathname === item.href ||
    (item.href !== "/" && pathname.startsWith(item.href + "/")) ||
    (item.children?.some((c) => pathname.startsWith(c.href)) ?? false)
  );
}

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Sluit het mobiele menu automatisch zodra je effectief naar een andere
  // pagina navigeert — anders blijft het openstaan tot je zelf op de
  // hamburger-knop klikt, wat op een klein scherm al snel verwarrend voelt.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      <nav className="hidden items-center gap-0.5 sm:flex">
        {items.map((item) => {
          const Icon = ICONS[item.href];
          const isActive = isNavItemActive(item, pathname);

          const link = (
            <Link
              href={item.href}
              className={`flex items-center gap-1 rounded-md px-2 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {Icon && <Icon size={15} strokeWidth={2} />}
              {item.compactLabel ? (
                <span className="hidden lg:inline">{item.label}</span>
              ) : (
                item.label
              )}
              {item.children && <ChevronDown size={12} />}
              {!!item.badge && (
                <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-semibold text-white">
                  {item.badge}
                </span>
              )}
            </Link>
          );

          if (!item.children) {
            return <div key={item.href}>{link}</div>;
          }

          return (
            <div key={item.href} className="group relative">
              {link}
              {/* pt-1 i.p.v. mt-1 op de buitenste laag: een margin zou een dode
                  zone tussen link en paneel laten waar de cursor "uit" de hover
                  valt vóór hij het paneel bereikt; padding blijft deel van de
                  hoverbare box, dus de hover blijft onafgebroken behouden. */}
              <div className="invisible absolute left-0 top-full z-50 w-52 pt-1 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100">
                <div className="rounded-md border border-slate-200 bg-white p-1.5 shadow-lg">
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={`block rounded-md px-3 py-2 text-sm ${
                        pathname.startsWith(child.href)
                          ? "bg-slate-100 font-medium text-slate-900"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* Hover werkt niet op een touchscreen, en 9 items past sowieso niet
          naast elkaar op een smal scherm — vandaar een hamburgermenu met een
          uitklappaneel i.p.v. de bovenstaande horizontale balk. Vereist
          `relative` op de <header> (zie layout.tsx) zodat dit paneel exact
          onder de volledige header positioneert, ongeacht de headerhoogte. */}
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        aria-expanded={mobileOpen}
        aria-label={mobileOpen ? "Menu sluiten" : "Menu openen"}
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 sm:hidden"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {mobileOpen && (
        <div className="absolute inset-x-0 top-full z-50 max-h-[calc(100vh-4rem)] overflow-y-auto border-b border-slate-200 bg-white p-3 shadow-lg sm:hidden">
          <nav className="flex flex-col gap-1">
            {items.map((item) => {
              const Icon = ICONS[item.href];
              const isActive = isNavItemActive(item, pathname);
              return (
                <div key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-2 rounded-md px-3 py-2.5 text-base font-medium ${
                      isActive
                        ? "bg-slate-900 text-white"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {Icon && <Icon size={17} strokeWidth={2} />}
                    {item.label}
                    {!!item.badge && (
                      <span className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-semibold text-white">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                  {item.children && (
                    <div className="ml-6 mt-0.5 flex flex-col gap-0.5 border-l border-slate-100 pl-3">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={`rounded-md px-3 py-2 text-sm ${
                            pathname.startsWith(child.href)
                              ? "bg-slate-100 font-medium text-slate-900"
                              : "text-slate-500 hover:bg-slate-50"
                          }`}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
}
