"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ListChecks,
  TrendingUp,
  Briefcase,
  Trophy,
  UserCheck,
  CalendarDays,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/leads": Users,
  "/taken": ListChecks,
  "/funnel/FA": TrendingUp,
  "/funnel/RG": Briefcase,
  "/klanten": UserCheck,
  "/incentives": Trophy,
  "/evenementen": CalendarDays,
};

export function NavLinks({
  items,
}: {
  items: { href: string; label: string; badge?: number }[];
}) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {items.map((item) => {
        const Icon = ICONS[item.href];
        const isActive =
          pathname === item.href ||
          (item.href !== "/" && pathname.startsWith(item.href + "/"));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-base font-medium transition-colors ${
              isActive
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {Icon && <Icon size={17} strokeWidth={2} />}
            {item.label}
            {!!item.badge && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-semibold text-white">
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
