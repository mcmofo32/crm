"use client";

import { useTransition } from "react";

/** Select die bij wijziging meteen zichzelf indient via een server action. */
export function InlineSelect({
  action,
  name,
  value,
  options,
  className,
}: {
  action: (formData: FormData) => void | Promise<void>;
  name: string;
  value: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      name={name}
      defaultValue={value}
      disabled={pending}
      onChange={(e) => {
        const formData = new FormData();
        formData.set(name, e.target.value);
        startTransition(() => {
          action(formData);
        });
      }}
      className={
        className ??
        "rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm disabled:opacity-60"
      }
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
