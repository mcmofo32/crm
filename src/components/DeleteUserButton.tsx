"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteUserAction } from "@/lib/actions/users";

export function DeleteUserButton({
  userId,
  userName,
  leadsCount,
  reassignableUsers,
}: {
  userId: string;
  userName: string;
  leadsCount: number;
  reassignableUsers: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [newOwnerId, setNewOwnerId] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const hasLeads = leadsCount > 0;
  const nameMatches =
    confirmText.trim().toLowerCase() === userName.trim().toLowerCase();
  const canSubmit = nameMatches;

  function handleClick() {
    if (!canSubmit) return;
    if (
      !confirm(
        `Laatste bevestiging: "${userName}" definitief verwijderen? Dit account kan niet meer inloggen en verdwijnt overal uit de keuzelijsten. Dit kan niet ongedaan gemaakt worden.`
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await deleteUserAction(userId, newOwnerId || null);
        router.push("/beheer/gebruikers");
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Er ging iets mis. Probeer opnieuw."
        );
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {hasLeads && (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-red-900">
            Deze gebruiker heeft nog {leadsCount}{" "}
            {leadsCount === 1 ? "klant/lead" : "klanten/leads"}. Optioneel:
            zet deze over naar — laat leeg om ze gewoon bij dit
            (verwijderde) profiel te laten staan.
          </label>
          <select
            value={newOwnerId}
            onChange={(e) => setNewOwnerId(e.target.value)}
            className="rounded-md border border-red-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Niet overzetten</option>
            {reassignableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-red-900">
          Typ de naam &quot;{userName}&quot; om te bevestigen:
        </label>
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={userName}
          className="rounded-md border border-red-300 bg-white px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button
        type="button"
        disabled={!canSubmit || pending}
        onClick={handleClick}
        className="flex w-fit items-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Trash2 size={15} />
        Profiel verwijderen
      </button>
    </div>
  );
}
