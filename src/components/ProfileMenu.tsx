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
  LogIn,
  Eye,
  Target,
  CloudUpload,
  Newspaper,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { DropdownMenu } from "@/components/DropdownMenu";
import { ROLE_LABELS, ROLE_BADGE_VARIANT } from "@/lib/roleLabels";
import {
  canManageSettings,
  canManageUsers,
  canViewBeheerderTools,
} from "@/lib/permissions";
import { ViewAsControls } from "@/components/ViewAsControls";
import type { EffectiveViewer } from "@/lib/impersonation";
import { JobFunction, Role } from "@/generated/prisma/client";

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
  jobFunction,
  photoUrl,
}: {
  name: string;
  viewer: EffectiveViewer;
  jobFunction?: JobFunction | null;
  photoUrl?: string | null;
}) {
  const showUserManagement = canManageUsers(viewer);
  const showBeheerderTools = canViewBeheerderTools(viewer);
  const showSettingsManagement = canManageSettings(viewer);
  // Een Coach mag de doelen van zijn eigen medewerkers aanpassen, ook zonder
  // verder gebruikersbeheer te mogen (zie proxy.ts + requireEmployeeGoalManager).
  const showEmployeeGoals = showUserManagement || viewer.role === Role.COACH;
  const canImpersonate = viewer.realRole === Role.BEHEERDER;

  const trigger = (
    <>
      <Avatar name={name} size="md" photoUrl={photoUrl} />
      <div className="flex flex-col leading-tight">
        <span className="flex items-center gap-1.5 text-base font-medium text-slate-800">
          {name}
          {jobFunction && (
            <span className="text-sm font-normal text-slate-400">
              {jobFunction}
            </span>
          )}
        </span>
        <Badge variant={ROLE_BADGE_VARIANT[viewer.role]} className="w-fit">
          {ROLE_LABELS[viewer.role]}
          {viewer.isImpersonating ? " (bekeken)" : ""}
        </Badge>
      </div>
      <ChevronDown
        size={16}
        className="text-slate-400 transition-transform group-open:rotate-180"
      />
    </>
  );

  return (
    <DropdownMenu trigger={trigger}>
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
        </>
      )}
      {showEmployeeGoals && (
        <>
          {!showUserManagement && <SectionLabel>Beheer</SectionLabel>}
          <MenuLink href="/beheer/doelen" icon={Target}>
            Doelen
          </MenuLink>
        </>
      )}
      {showUserManagement && showSettingsManagement && (
        <MenuLink href="/beheer/backup" icon={CloudUpload}>
          Google Sheets back-up
        </MenuLink>
      )}
      {showBeheerderTools && (
        <>
          <SectionLabel>Beheerderstools</SectionLabel>
          <MenuLink href="/beheer/dagrapport" icon={Newspaper}>
            Dagrapport
          </MenuLink>
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
          <MenuLink href="/beheer/login-sessies" icon={LogIn}>
            Login-sessies
          </MenuLink>
        </>
      )}
      {(showUserManagement || showEmployeeGoals || showBeheerderTools) && (
        <hr className="my-1.5 border-slate-100" />
      )}
      <MenuLink href="/instellingen" icon={Settings}>
        Instellingen
      </MenuLink>
    </DropdownMenu>
  );
}
