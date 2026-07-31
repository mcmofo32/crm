"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveTeamMemberAction } from "@/lib/actions/teams";

export function TeamDropZone({
  teamId,
  children,
}: {
  teamId: string;
  children: React.ReactNode;
}) {
  const [isOver, setIsOver] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsOver(false);
        const userId = e.dataTransfer.getData("text/plain");
        if (!userId) return;
        startTransition(async () => {
          try {
            await moveTeamMemberAction(userId, teamId);
            router.refresh();
          } catch (err) {
            alert(err instanceof Error ? err.message : "Kon lid niet verplaatsen");
          }
        });
      }}
      className={`rounded-lg transition ${
        isOver ? "ring-2 ring-slate-900 ring-offset-2" : ""
      } ${pending ? "opacity-60" : ""}`}
    >
      {children}
    </div>
  );
}
