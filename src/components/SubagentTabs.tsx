import Link from "next/link";

export function SubagentTabs({ active }: { active: "klanten" | "polissen" }) {
  const tabs = [
    { key: "klanten" as const, label: "Klanten onder beheer", href: "/subagent" },
    { key: "polissen" as const, label: "Polissen", href: "/subagent/polissen" },
  ];

  return (
    <div className="flex gap-2 text-base">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`rounded-full px-4 py-1.5 ${
            active === tab.key
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              : "bg-white text-slate-600 border border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
