"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteTeamAction } from "@/lib/actions/teams";

export function DeleteTeamButton({
  teamId,
  teamName,
  memberCount,
  variant = "button",
}: {
  teamId: string;
  teamName: string;
  memberCount: number;
  variant?: "button" | "menu-item";
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    const warning =
      memberCount > 0
        ? `Team "${teamName}" verwijderen? De ${memberCount} teamleden (en hun eventuele eigen structuur) blijven bestaan maar hebben nadien geen team meer.`
        : `Team "${teamName}" verwijderen?`;
    if (!confirm(warning)) return;
    startTransition(async () => {
      await deleteTeamAction(teamId);
      router.refresh();
    });
  }

  if (variant === "menu-item") {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={handleClick}
        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
      >
        <Trash2 size={15} />
        Team verwijderen
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleClick}
      className="flex items-center gap-1.5 rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
    >
      <Trash2 size={14} />
      Team verwijderen
    </button>
  );
}
