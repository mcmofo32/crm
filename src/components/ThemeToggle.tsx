"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sun, Moon } from "lucide-react";
import { setThemeAction, type Theme } from "@/lib/actions/theme";

/** Zet het thema-voorkeur (cookie, zie lib/actions/theme.ts) en herlaadt de server-render meteen — geen client-only flikkering, want de root layout leest dezelfde cookie al vóór de eerste render. */
export function ThemeToggle({ theme }: { theme: Theme }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function select(next: Theme) {
    if (next === theme) return;
    startTransition(async () => {
      await setThemeAction(next);
      router.refresh();
    });
  }

  return (
    <div className="inline-flex rounded-md border border-slate-300 p-0.5 dark:border-slate-700">
      <button
        type="button"
        disabled={pending}
        onClick={() => select("light")}
        className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium disabled:opacity-60 ${
          theme === "light"
            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
            : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        }`}
      >
        <Sun size={14} />
        Licht
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => select("dark")}
        className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium disabled:opacity-60 ${
          theme === "dark"
            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
            : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        }`}
      >
        <Moon size={14} />
        Donker
      </button>
    </div>
  );
}
