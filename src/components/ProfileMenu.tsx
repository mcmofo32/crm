import Link from "next/link";
import { BarChart3, Trash2, ChevronDown } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { ROLE_LABELS, ROLE_BADGE_VARIANT } from "@/lib/roleLabels";
import type { Role } from "@/generated/prisma/client";

export function ProfileMenu({
  name,
  role,
  isBeheerder,
}: {
  name: string;
  role: Role;
  isBeheerder: boolean;
}) {
  if (!isBeheerder) {
    return (
      <div className="flex items-center gap-3">
        <Avatar name={name} size="md" />
        <div className="flex flex-col leading-tight">
          <span className="text-base font-medium text-slate-800">{name}</span>
          <Badge variant={ROLE_BADGE_VARIANT[role]} className="w-fit">
            {ROLE_LABELS[role]}
          </Badge>
        </div>
      </div>
    );
  }

  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-1 py-1 hover:bg-slate-100 [&::-webkit-details-marker]:hidden">
        <Avatar name={name} size="md" />
        <div className="flex flex-col leading-tight">
          <span className="text-base font-medium text-slate-800">{name}</span>
          <Badge variant={ROLE_BADGE_VARIANT[role]} className="w-fit">
            {ROLE_LABELS[role]}
          </Badge>
        </div>
        <ChevronDown
          size={16}
          className="text-slate-400 transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-56 rounded-md border border-slate-200 bg-white p-1.5 shadow-lg">
        <p className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
          Beheerderstools
        </p>
        <Link
          href="/beheer/analyse"
          className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-700 hover:bg-slate-100"
        >
          <BarChart3 size={16} />
          Analyse
        </Link>
        <Link
          href="/beheer/prullenbak"
          className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-700 hover:bg-slate-100"
        >
          <Trash2 size={16} />
          Verwijderde leads
        </Link>
      </div>
    </details>
  );
}
