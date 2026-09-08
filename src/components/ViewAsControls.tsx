"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, RotateCcw, UserCog } from "lucide-react";
import { setViewAsRoleAction, clearViewAsRoleAction } from "@/lib/impersonation";
import { ROLE_LABELS } from "@/lib/roleLabels";
import { Role } from "@/generated/prisma/enums";
import { ViewAsEmployeeModal } from "@/components/ViewAsEmployeeModal";

const OPTIONS = [Role.ADMIN, Role.COACH, Role.USER];

type Employee = { id: string; name: string; roleLabel: string };

export function ViewAsControls({
  currentRole,
  isImpersonating,
  inline = false,
  employees = [],
  viewingAsName,
}: {
  currentRole: Role;
  isImpersonating: boolean;
  inline?: boolean;
  /** Enkel nodig op de niet-inline (uitklapmenu) variant, voor de "Medewerker"-lijst. */
  employees?: Employee[];
  /** Naam van de medewerker waarvan je nu het perspectief bekijkt — enkel gezet bij een volledige identiteitswissel (niet bij een rol-voorbeeld). */
  viewingAsName?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
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
        // Bij een volledige medewerker-wissel is currentRole diens eigen rol
        // — kan toevallig overeenkomen met een van deze knoppen, maar dat is
        // dan geen rol-voorbeeld, dus niet als actief tonen.
        const active = isImpersonating && !viewingAsName && currentRole === role;
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
      <button
        type="button"
        disabled={pending}
        onClick={() => setEmployeeModalOpen(true)}
        className={`flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-slate-100 disabled:opacity-60 ${
          viewingAsName ? "bg-slate-100 font-medium text-slate-900" : "text-slate-700"
        }`}
      >
        <UserCog size={14} />
        {viewingAsName ? `Medewerker: ${viewingAsName}` : "Medewerker..."}
      </button>
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
      <ViewAsEmployeeModal
        open={employeeModalOpen}
        onClose={() => setEmployeeModalOpen(false)}
        employees={employees}
      />
    </div>
  );
}
