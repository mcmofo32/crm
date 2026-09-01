"use client";

import { useActionState, useEffect, useRef } from "react";
import type { UpdateUserState } from "@/lib/actions/users";
import { useToast } from "@/components/toast/ToastProvider";

export function EditUserForm({
  action,
  children,
}: {
  action: (
    prevState: UpdateUserState,
    formData: FormData
  ) => Promise<UpdateUserState>;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const wasPending = useRef(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      showToast("Opgeslagen");
    }
    wasPending.current = pending;
  }, [pending, state, showToast]);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        const role = new FormData(e.currentTarget).get("role");
        if (
          role === "ADMIN" &&
          !confirm(
            "Weet je zeker dat je deze gebruiker Admin-rechten wilt geven? Dit geeft toegang tot bijna alle beheerfuncties."
          )
        ) {
          e.preventDefault();
        }
      }}
      className="flex flex-col gap-4 text-sm"
    >
      {state?.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
          {state.error}
        </div>
      )}
      {children}
    </form>
  );
}
