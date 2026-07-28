import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canManageUsers } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/roleLabels";
import { logoutAction } from "@/lib/actions/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user;
  const navItems = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/leads", label: "Leads" },
    { href: "/taken", label: "Taken" },
    { href: "/funnel/FA", label: "Funnel FA" },
    { href: "/funnel/RG", label: "Funnel RG" },
    { href: "/incentives", label: "Incentives" },
  ];

  if (canManageUsers(user)) {
    navItems.push({ href: "/beheer/gebruikers", label: "Gebruikers" });
  }
  navItems.push({ href: "/instellingen", label: "Instellingen" });

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-8">
            <span className="text-2xl font-semibold text-slate-900">CRM</span>
            <nav className="flex items-center gap-5">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-base text-slate-600 hover:text-slate-900"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-base text-slate-500">
              {user.name}{" "}
              <span className="rounded bg-slate-100 px-2 py-1 text-sm font-medium text-slate-600">
                {ROLE_LABELS[user.role]}
              </span>
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-base text-slate-500 hover:text-slate-900"
              >
                Uitloggen
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
