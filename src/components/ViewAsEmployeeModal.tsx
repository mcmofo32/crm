"use client";

import { useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { setViewAsUserAction } from "@/lib/impersonation";
import { useToastAction } from "@/components/toast/useToastAction";

type Employee = { id: string; name: string; roleLabel: string };

export function ViewAsEmployeeModal({
  open,
  onClose,
  employees,
}: {
  open: boolean;
  onClose: () => void;
  employees: Employee[];
}) {
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { runWithToast } = useToastAction();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => e.name.toLowerCase().includes(q));
  }, [employees, query]);

  if (!open) return null;

  function handleSelect(userId: string, name: string) {
    startTransition(async () => {
      try {
        await runWithToast(async () => {
          const result = await setViewAsUserAction(userId);
          if (result?.error) throw new Error(result.error);
        }, `Je bekijkt de CRM nu als ${name}`);
        router.refresh();
        onClose();
      } catch {
        // Foutmelding is al getoond door runWithToast — dialoog blijft open.
      }
    });
  }

  // Via een portal naar document.body gerenderd — dit component leeft
  // binnen het "Bekijk als"-uitklapmenu (een native <details>), dat zijn
  // niet-samenvattende inhoud (dus ook dit modaal) native verbergt zodra het
  // sluit. Een portal ontsnapt aan die DOM-hiërarchie, anders verdwijnt het
  // modaal meteen weer op exact de klik die het had moeten openen.
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/30 pt-24"
      onClick={onClose}
    >
      <div
        className="flex max-h-[70vh] w-full max-w-sm flex-col rounded-lg border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-base font-medium text-slate-900">
            Bekijk als medewerker
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={16} />
          </button>
        </div>
        <div className="border-b border-slate-100 p-3">
          <div className="flex items-center gap-2 rounded-md border border-slate-300 px-2.5 py-1.5">
            <Search size={14} className="text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Zoek op naam..."
              className="w-full text-sm outline-none"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <p className="px-2.5 py-3 text-sm text-slate-400">
              Geen medewerker gevonden.
            </p>
          ) : (
            filtered.map((employee) => (
              <button
                key={employee.id}
                type="button"
                disabled={pending}
                onClick={() => handleSelect(employee.id, employee.name)}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                <span>{employee.name}</span>
                <span className="text-xs text-slate-400">{employee.roleLabel}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
