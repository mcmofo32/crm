import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut, Eye, Bell } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canManageCustomerData, canViewBeheerderTools } from "@/lib/permissions";
import { getCrossOwnerDuplicateGroups } from "@/lib/actions/duplicates";
import { touchLoginActivity } from "@/lib/actions/sessions";
import { logoutAction } from "@/lib/actions/auth";
import { ROLE_LABELS } from "@/lib/roleLabels";
import { NavLinks } from "@/components/NavLinks";
import { ProfileMenu } from "@/components/ProfileMenu";
import { ViewAsControls } from "@/components/ViewAsControls";
import { Logo } from "@/components/Logo";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await getEffectiveViewer();
  if (!viewer) redirect("/login");
  await touchLoginActivity(viewer.id);

  const viewerDetails = await prisma.user.findUnique({
    where: { id: viewer.id },
    select: { jobFunction: true, avatarUpdatedAt: true },
  });
  const photoUrl = viewerDetails?.avatarUpdatedAt
    ? `/api/users/${viewer.id}/avatar?v=${viewerDetails.avatarUpdatedAt.getTime()}`
    : null;
  // Enkel de eigen verlopen taken van de ingelogde gebruiker tellen mee voor
  // het badge-cijfer naast "Taken" — anders krijgt bv. een coach of
  // beheerder hier het totaal van zijn hele team te zien, wat aanvoelt als
  // een melding over eigen niet-afgewerkte taken terwijl dat niet zo is.
  const overdueTasks = await prisma.activity.count({
    where: {
      status: "PLANNED",
      scheduledAt: { lt: new Date() },
      assigneeId: viewer.id,
      lead: { deletedAt: null },
    },
  });

  const duplicateLeadCount = canViewBeheerderTools(viewer)
    ? (await getCrossOwnerDuplicateGroups()).length
    : 0;

  const navItems = [
    { href: "/dashboard", label: "Dashboard" },
    {
      href: "/pipeline/verkoop",
      label: "Pipeline",
      children: [
        { href: "/pipeline/verkoop", label: "Pipeline verkoop" },
        { href: "/pipeline/recrutering", label: "Pipeline Rekrutering" },
      ],
    },
    { href: "/taken", label: "Taken", badge: overdueTasks },
    {
      href: "/funnel/FA",
      label: "Funnel",
      children: [
        { href: "/funnel/FA", label: "FA Funnel" },
        { href: "/funnel/RG", label: "RG Funnel" },
      ],
    },
    { href: "/klanten", label: "Klanten" },
    { href: "/incentives", label: "Incentives" },
    { href: "/evenementen", label: "Evenementen" },
    { href: "/organigram", label: "Organigram" },
    { href: "/productie", label: "Cijfers" },
    // Enkel zichtbaar voor subagenten en Beheerder/Admin (zelfde
    // toegangsregel als de klantendata-bewerkrechten elders).
    ...(canManageCustomerData(viewer)
      ? [
          {
            href: "/subagent",
            label: "Subagent",
            children: [
              { href: "/subagent", label: "Klanten onder beheer" },
              { href: "/subagent/polissen", label: "Polissen" },
            ],
          },
        ]
      : []),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-2.5 lg:px-10">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Logo size={52} />
              Structuur A
            </span>
            <NavLinks items={navItems} />
          </div>
          <div className="flex items-center gap-3">
            {canViewBeheerderTools(viewer) && (
              <Link
                href="/beheer/duplicaten"
                title={
                  duplicateLeadCount > 0
                    ? `${duplicateLeadCount} dubbele lead${duplicateLeadCount === 1 ? "" : "s"} gevonden`
                    : "Geen dubbele leads"
                }
                className="relative flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <Bell size={18} />
                {duplicateLeadCount > 0 && (
                  <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-semibold text-white">
                    {duplicateLeadCount}
                  </span>
                )}
              </Link>
            )}
            <ProfileMenu
              name={viewer.name}
              viewer={viewer}
              jobFunction={viewerDetails?.jobFunction ?? null}
              photoUrl={photoUrl}
            />
            <form action={logoutAction}>
              <button
                type="submit"
                title="Uitloggen"
                className="ml-2 flex items-center gap-1.5 rounded-md px-2 py-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <LogOut size={18} />
              </button>
            </form>
          </div>
        </div>
      </header>

      {viewer.isImpersonating && (
        <div className="border-b border-amber-200 bg-amber-50">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2 px-6 py-2.5 text-sm text-amber-800 lg:px-10">
            <span className="flex items-center gap-2">
              <Eye size={16} />
              Testomgeving: je bekijkt de CRM als{" "}
              <strong>{ROLE_LABELS[viewer.role]}</strong> — dit is enkel een
              voorbeeldweergave, je bent nog steeds ingelogd als jezelf.
            </span>
            <ViewAsControls currentRole={viewer.role} isImpersonating inline />
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-6 py-8 lg:px-10">
        {children}
      </main>
    </div>
  );
}
