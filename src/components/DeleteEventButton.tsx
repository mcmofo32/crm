"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteEventAction } from "@/lib/actions/events";

export function DeleteEventButton({
  eventId,
  eventTitle,
}: {
  eventId: string;
  eventTitle: string;
}) {
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    if (!confirm(`Evenement "${eventTitle}" verwijderen?`)) return;
    startTransition(() => {
      deleteEventAction(eventId);
    });
  };

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleClick}
      className="flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
    >
      <Trash2 size={15} />
      Verwijderen
    </button>
  );
}
