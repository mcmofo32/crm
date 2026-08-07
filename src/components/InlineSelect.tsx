"use client";

import { useTransition } from "react";

/** Select die bij wijziging meteen zichzelf indient via een server action. */
export function InlineSelect({
  action,
  name,
  value,
  options,
  className,
  style,
}: {
  action: (formData: FormData) => void | Promise<void>;
  name: string;
  value: string;
  options: { value: string; label: string; style?: React.CSSProperties }[];
  className?: string;
  /** Kleurt de select zelf (bv. de kleur van de huidige status), los van de kleur per option. */
  style?: React.CSSProperties;
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
      style={style}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} style={option.style}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
