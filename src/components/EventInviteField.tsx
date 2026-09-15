"use client";

import { useState } from "react";
import { Users2 } from "lucide-react";

type InviteUser = { id: string; name: string; email: string | null; isManagement: boolean };
type InviteSubagent = { id: string; name: string; email: string; teamName: string };

/**
 * Wie uitnodigen op een evenement: individueel aan te vinken, of in bulk via
 * de knoppen hieronder (voegen toe aan de selectie, vervangen ze niet).
 * Rendert gewone checkboxes met `name="userIds"`/`name="subagentIds"` —
 * werkt dus gewoon mee met de omringende `<form action={...}>` (native
 * FormData.getAll), geen aparte submit-logica nodig.
 */
export function EventInviteField({
  users,
  subagents,
}: {
  users: InviteUser[];
  subagents: InviteSubagent[];
}) {
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [selectedSubagentIds, setSelectedSubagentIds] = useState<Set<string>>(new Set());

  function toggleUser(id: string) {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleSubagent(id: string) {
    setSelectedSubagentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function addUsers(ids: string[]) {
    setSelectedUserIds((prev) => new Set([...prev, ...ids]));
  }

  const managementIds = users.filter((u) => u.isManagement).map((u) => u.id);
  const allUserIds = users.map((u) => u.id);
  const totalInvited = selectedUserIds.size + selectedSubagentIds.size;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
          <Users2 size={13} />
          Uitnodigen (optioneel)
        </span>
        {totalInvited > 0 && (
          <span className="text-xs text-slate-500">{totalInvited} geselecteerd</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSelectedSubagentIds((prev) => new Set([...prev, ...subagents.map((s) => s.id)]))}
          disabled={subagents.length === 0}
          className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        >
          + Alle subagenten
        </button>
        <button
          type="button"
          onClick={() => addUsers(managementIds)}
          disabled={managementIds.length === 0}
          className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        >
          + Management
        </button>
        <button
          type="button"
          onClick={() => addUsers(allUserIds)}
          disabled={allUserIds.length === 0}
          className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        >
          + Structuur A (iedereen)
        </button>
        {totalInvited > 0 && (
          <button
            type="button"
            onClick={() => {
              setSelectedUserIds(new Set());
              setSelectedSubagentIds(new Set());
            }}
            className="rounded-full px-3 py-1 text-xs font-medium text-slate-400 hover:text-slate-600"
          >
            Selectie wissen
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="max-h-48 overflow-y-auto rounded-md border border-slate-200 bg-white p-2">
          <p className="mb-1 px-1 text-xs font-medium text-slate-400">Medewerkers</p>
          {users.map((u) => (
            <label
              key={u.id}
              className="flex items-center gap-2 rounded px-1 py-1 text-sm text-slate-700 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                name="userIds"
                value={u.id}
                checked={selectedUserIds.has(u.id)}
                onChange={() => toggleUser(u.id)}
              />
              {u.name}
              {u.isManagement && <span className="text-xs text-slate-400">(management)</span>}
            </label>
          ))}
          {users.length === 0 && (
            <p className="px-1 py-1 text-xs text-slate-400">Geen medewerkers.</p>
          )}
        </div>

        <div className="max-h-48 overflow-y-auto rounded-md border border-slate-200 bg-white p-2">
          <p className="mb-1 px-1 text-xs font-medium text-slate-400">Subagenten</p>
          {subagents.map((s) => (
            <label
              key={s.id}
              className="flex items-center gap-2 rounded px-1 py-1 text-sm text-slate-700 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                name="subagentIds"
                value={s.id}
                checked={selectedSubagentIds.has(s.id)}
                onChange={() => toggleSubagent(s.id)}
              />
              {s.name}
              <span className="text-xs text-slate-400">({s.teamName})</span>
            </label>
          ))}
          {subagents.length === 0 && (
            <p className="px-1 py-1 text-xs text-slate-400">Geen subagenten.</p>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Geselecteerden krijgen een Google Agenda-uitnodiging (als ze een
        e-mailadres hebben) vanaf jouw gekoppelde agenda. Niemand
        selecteren houdt het evenement enkel intern zichtbaar, zoals
        vandaag.
      </p>
    </div>
  );
}
