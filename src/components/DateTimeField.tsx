"use client";

import { useState } from "react";

type DateParts = { day: string; month: string; year: string; time: string };

function splitValue(value: string): DateParts {
  if (!value) return { day: "", month: "", year: "", time: "" };
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-");
  return { day: day ?? "", month: month ?? "", year: year ?? "", time: timePart ?? "" };
}

/**
 * Vervangt `<input type="datetime-local">` voor het "Van"-veld bij het
 * inplannen van een afspraak: die toont/parseert de datum in de locale van
 * de browser (bv. mm/dd/jjjj bij een Engelstalige browser-instelling) — wie
 * in dd/mm-volgorde typt (bv. dag 19 in een mm/dd-veld, wat geen geldige
 * maand is) krijgt dan een stil verworpen, lege waarde terug, zonder
 * duidelijke foutmelding waarom. Dag/maand/jaar staan hier als aparte
 * velden, altijd in die vaste volgorde, ongeacht browserinstellingen.
 *
 * Geeft dezelfde waardevorm door als `datetime-local` ("YYYY-MM-DDTHH:mm",
 * of "" zolang niet alles ingevuld/geldig is) — bestaande verwerking
 * (buildMeetingFormData/parseLocalDateTime) hoeft dus niet aangepast.
 */
export function DateTimeField({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [parts, setParts] = useState<DateParts>(() => splitValue(value));
  const [lastSyncedValue, setLastSyncedValue] = useState(value);

  // Enkel synchroniseren wanneer de waarde van buitenaf leeggemaakt wordt
  // (bv. formulier-reset na opslaan/annuleren) — niet bij elke render, want
  // zolang niet alle 4 velden ingevuld zijn blijft de samengestelde waarde
  // "", wat anders de al ingevulde dag/maand telkens zou terugzetten. State
  // aanpassen tijdens render (i.p.v. in een effect) is hier de aanbevolen
  // aanpak — zie https://react.dev/learn/you-might-not-need-an-effect.
  if (value !== lastSyncedValue) {
    setLastSyncedValue(value);
    if (!value) setParts({ day: "", month: "", year: "", time: "" });
  }

  function update(next: Partial<DateParts>) {
    const merged = { ...parts, ...next };
    setParts(merged);

    const dayNum = Number(merged.day);
    const monthNum = Number(merged.month);
    const yearNum = Number(merged.year);
    const isValidDate =
      merged.day.trim() !== "" &&
      merged.month.trim() !== "" &&
      merged.year.trim().length === 4 &&
      merged.time.trim() !== "" &&
      monthNum >= 1 &&
      monthNum <= 12 &&
      dayNum >= 1 &&
      dayNum <= 31 &&
      // Voorkomt een niet-bestaande datum (bv. 31 februari) — JS "rolt" die
      // anders gewoon door naar de volgende maand i.p.v. ze te weigeren.
      new Date(yearNum, monthNum - 1, dayNum).getMonth() === monthNum - 1;

    onChange(
      isValidDate
        ? `${merged.year}-${merged.month.padStart(2, "0")}-${merged.day.padStart(2, "0")}T${merged.time}`
        : ""
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className ?? ""}`}>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={31}
        placeholder="dd"
        value={parts.day}
        onChange={(e) => update({ day: e.target.value })}
        className="w-14 rounded-md border border-slate-300 px-2 py-2 text-sm"
      />
      <span className="text-slate-400">/</span>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={12}
        placeholder="mm"
        value={parts.month}
        onChange={(e) => update({ month: e.target.value })}
        className="w-14 rounded-md border border-slate-300 px-2 py-2 text-sm"
      />
      <span className="text-slate-400">/</span>
      <input
        type="number"
        inputMode="numeric"
        min={2000}
        max={2100}
        placeholder="jjjj"
        value={parts.year}
        onChange={(e) => update({ year: e.target.value })}
        className="w-20 rounded-md border border-slate-300 px-2 py-2 text-sm"
      />
      <input
        type="time"
        value={parts.time}
        onChange={(e) => update({ time: e.target.value })}
        className="rounded-md border border-slate-300 px-2 py-2 text-sm"
      />
    </div>
  );
}
