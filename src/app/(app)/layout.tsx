import { redirect } from "next/navigation";
import { LogOut, Sparkles } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageUsers, getVisibleUserIds, isBeheerder } from "@/lib/permissions";
import { logoutAction } from "@/lib/actions/auth";
import { NavLinks } from "@/components/NavLinks";
import { ProfileMenu } from "@/components/ProfileMenu";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user;
  const visibleUserIds = await getVisibleUserIds(user);
  const overdueTasks = await prisma.activity.count({
    where: {
      status: "PLANNED",
      scheduledAt: { lt: new Date() },
      lead: {
        deletedAt: null,
        ...(visibleUserIds ? { ownerId: { in: visibleUserIds } } : {}),
      },
    },
  });

  const navItems = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/leads", label: "Leads" },
    { href: "/taken", label: "Taken", badge: overdueTasks },
    { href: "/funnel/FA", label: "Funnel FA" },
    { href: "/funnel/RG", label: "Funnel RG" },
    { href: "/incentives", label: "Incentives" },
  ];

  if (canManageUsers(user)) {
    navItems.push({ href: "/beheer/gebruikers", label: "Gebruikers" });
    navItems.push({ href: "/beheer/teams", label: "Teams" });
  }
  navItems.push({ href: "/instellingen", label: "Instellingen" });

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-3 lg:px-10">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
                <Sparkles size={18} />
              </span>
              CRM
            </span>
            <NavLinks items={navItems} />
          </div>
          <div className="flex items-center gap-3">
            <ProfileMenu
              name={user.name ?? "?"}
              role={user.role}
              isBeheerder={isBeheerder(user)}
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
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-6 py-8 lg:px-10">
        {children}
      </main>
    </div>
  );
}
