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
  UserCog,
  Settings,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/leads": Users,
  "/taken": ListChecks,
  "/funnel/FA": TrendingUp,
  "/funnel/RG": Briefcase,
  "/incentives": Trophy,
  "/beheer/gebruikers": UserCog,
  "/instellingen": Settings,
};

export function NavLinks({
  items,
}: {
  items: { href: string; label: string }[];
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
          </Link>
        );
      })}
    </nav>
  );
}
