"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ListChecks,
  TrendingUp,
  Trophy,
  UserCheck,
  CalendarDays,
  Network,
  ChevronDown,
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
};

type NavItem = {
  href: string;
  label: string;
  badge?: number;
  children?: { href: string; label: string }[];
};

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-0.5">
      {items.map((item) => {
        const Icon = ICONS[item.href];
        const isActive =
          pathname === item.href ||
          (item.href !== "/" && pathname.startsWith(item.href + "/")) ||
          (item.children?.some((c) => pathname.startsWith(c.href)) ?? false);

        const link = (
          <Link
            href={item.href}
            className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {Icon && <Icon size={15} strokeWidth={2} />}
            {item.label}
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
            <div className="invisible absolute left-0 top-full z-50 mt-1 w-52 rounded-md border border-slate-200 bg-white p-1.5 opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100">
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
        );
      })}
    </nav>
  );
}
