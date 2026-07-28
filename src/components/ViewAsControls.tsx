"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, RotateCcw } from "lucide-react";
import { setViewAsRoleAction, clearViewAsRoleAction } from "@/lib/impersonation";
import { ROLE_LABELS } from "@/lib/roleLabels";
import { Role } from "@/generated/prisma/enums";

const OPTIONS = [Role.ADMIN, Role.COACH, Role.USER];

export function ViewAsControls({
  currentRole,
  isImpersonating,
  inline = false,
}: {
  currentRole: Role;
  isImpersonating: boolean;
  inline?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSelect(role: Role) {
    startTransition(async () => {
      await setViewAsRoleAction(role);
      router.refresh();
    });
  }

  function handleReset() {
    startTransition(async () => {
      await clearViewAsRoleAction();
      router.refresh();
    });
  }

  if (inline) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={handleReset}
        className="flex flex-shrink-0 items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-60"
      >
        <RotateCcw size={14} />
        Terug naar Beheerder
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {OPTIONS.map((role) => {
        const active = isImpersonating && currentRole === role;
        return (
          <button
            key={role}
            type="button"
            disabled={pending}
            onClick={() => handleSelect(role)}
            className={`flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-slate-100 disabled:opacity-60 ${
              active ? "bg-slate-100 font-medium text-slate-900" : "text-slate-700"
            }`}
          >
            <Eye size={14} />
            {ROLE_LABELS[role]}
          </button>
        );
      })}
      {isImpersonating && (
        <button
          type="button"
          disabled={pending}
          onClick={handleReset}
          className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-60"
        >
          <RotateCcw size={14} />
          Terug naar Beheerder
        </button>
      )}
    </div>
  );
}
