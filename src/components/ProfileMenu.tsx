import Link from "next/link";
import {
  BarChart3,
  Trash2,
  UserCog,
  Users2,
  Settings,
  ChevronDown,
  Copy,
  ScrollText,
  Eye,
  Target,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { ROLE_LABELS, ROLE_BADGE_VARIANT } from "@/lib/roleLabels";
import { canManageUsers, isBeheerder } from "@/lib/permissions";
import { ViewAsControls } from "@/components/ViewAsControls";
import type { EffectiveViewer } from "@/lib/impersonation";
import { Role } from "@/generated/prisma/client";

function MenuLink({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-700 hover:bg-slate-100"
    >
      <Icon size={16} />
      {children}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
      {children}
    </p>
  );
}

export function ProfileMenu({
  name,
  viewer,
}: {
  name: string;
  viewer: EffectiveViewer;
}) {
  const showUserManagement = canManageUsers(viewer);
  const showBeheerderTools = isBeheerder(viewer);
  const canImpersonate = viewer.realRole === Role.BEHEERDER;

  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-1 py-1 hover:bg-slate-100 [&::-webkit-details-marker]:hidden">
        <Avatar name={name} size="md" />
        <div className="flex flex-col leading-tight">
          <span className="text-base font-medium text-slate-800">{name}</span>
          <Badge variant={ROLE_BADGE_VARIANT[viewer.role]} className="w-fit">
            {ROLE_LABELS[viewer.role]}
            {viewer.isImpersonating ? " (bekeken)" : ""}
          </Badge>
        </div>
        <ChevronDown
          size={16}
          className="text-slate-400 transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-60 rounded-md border border-slate-200 bg-white p-1.5 shadow-lg">
        {canImpersonate && (
          <>
            <SectionLabel>
              <span className="flex items-center gap-1.5">
                <Eye size={12} />
                Bekijk als
              </span>
            </SectionLabel>
            <ViewAsControls
              currentRole={viewer.role}
              isImpersonating={viewer.isImpersonating}
            />
            <hr className="my-1.5 border-slate-100" />
          </>
        )}
        {showUserManagement && (
          <>
            <SectionLabel>Beheer</SectionLabel>
            <MenuLink href="/beheer/gebruikers" icon={UserCog}>
              Gebruikers
            </MenuLink>
            <MenuLink href="/beheer/teams" icon={Users2}>
              Teams
            </MenuLink>
            <MenuLink href="/beheer/doelen" icon={Target}>
              Doelen
            </MenuLink>
          </>
        )}
        {showBeheerderTools && (
          <>
            <SectionLabel>Beheerderstools</SectionLabel>
            <MenuLink href="/beheer/analyse" icon={BarChart3}>
              Analyse
            </MenuLink>
            <MenuLink href="/beheer/prullenbak" icon={Trash2}>
              Verwijderde leads
            </MenuLink>
            <MenuLink href="/beheer/duplicaten" icon={Copy}>
              Dubbele leads
            </MenuLink>
            <MenuLink href="/beheer/auditlog" icon={ScrollText}>
              Logboek
            </MenuLink>
          </>
        )}
        {(showUserManagement || showBeheerderTools) && (
          <hr className="my-1.5 border-slate-100" />
        )}
        <MenuLink href="/instellingen" icon={Settings}>
          Instellingen
        </MenuLink>
      </div>
    </details>
  );
}
