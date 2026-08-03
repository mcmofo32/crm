"use client";

import { useTransition } from "react";

/** Checkbox die bij wijziging meteen zichzelf indient via een server action. */
export function InlineCheckbox({
  action,
  name,
  checked,
}: {
  action: (formData: FormData) => void | Promise<void>;
  name: string;
  checked: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <input
      type="checkbox"
      disabled={pending}
      defaultChecked={checked}
      onChange={(e) => {
        const formData = new FormData();
        formData.set(name, e.target.checked ? "true" : "false");
        startTransition(() => {
          action(formData);
        });
      }}
      className="h-4 w-4 rounded border-slate-300"
    />
  );
}
