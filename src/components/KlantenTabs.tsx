import Link from "next/link";

export function KlantenTabs({ active }: { active: "klanten" | "polissen" }) {
  const tabs = [
    { key: "klanten" as const, label: "Klanten", href: "/klanten" },
    { key: "polissen" as const, label: "Polissen", href: "/klanten/polissen" },
  ];

  return (
    <div className="flex gap-2 text-base">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`rounded-full px-4 py-1.5 ${
            active === tab.key
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-600 border border-slate-200"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
