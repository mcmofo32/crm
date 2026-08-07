"use client";

import { useTransition } from "react";

/** Tekstveld dat pas bij het verlaten van het veld (blur) zichzelf indient. */
export function InlineTextField({
  action,
  name,
  value,
  placeholder,
  className,
  type = "text",
  min,
  step,
}: {
  action: (formData: FormData) => void | Promise<void>;
  name: string;
  value: string;
  placeholder?: string;
  className?: string;
  type?: "text" | "number" | "date";
  min?: string | number;
  step?: string | number;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <input
      type={type}
      name={name}
      min={min}
      step={step}
      defaultValue={value}
      placeholder={placeholder}
      disabled={pending}
      onBlur={(e) => {
        if (e.target.value === value) return;
        const formData = new FormData();
        formData.set(name, e.target.value);
        startTransition(() => {
          action(formData);
        });
      }}
      className={
        className ??
        "w-48 rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:opacity-60"
      }
    />
  );
}
