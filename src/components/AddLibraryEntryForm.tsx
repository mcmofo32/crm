"use client";

import { useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from "react";
import { Plus } from "lucide-react";
import { useToastAction } from "@/components/toast/useToastAction";

/** Herbruikt voor zowel "tabblad toevoegen" als "categorie toevoegen" (zie LibraryTabsBar). */
export function AddLibraryEntryForm({
  action,
  placeholder,
  successMessage,
}: {
  action: (formData: FormData) => Promise<void>;
  placeholder: string;
  successMessage: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const { runWithToast } = useToastAction();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await runWithToast(() => action(formData), successMessage);
        formRef.current?.reset();
        setOpen(false);
      } catch {
        // Foutmelding is al getoond door runWithToast.
      }
    });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Toevoegen"
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50"
      >
        <Plus size={14} />
      </button>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-shrink-0 items-center gap-1.5">
      <input
        name="name"
        autoFocus
        placeholder={placeholder}
        onKeyDown={handleKeyDown}
        className="w-40 rounded-full border border-slate-300 px-3 py-1.5 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white disabled:opacity-60"
      >
        <Plus size={14} />
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-sm text-slate-400 hover:text-slate-600"
      >
        Annuleren
      </button>
    </form>
  );
}
