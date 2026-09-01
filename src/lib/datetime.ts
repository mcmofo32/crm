/**
 * Alle afspraken in het CRM worden ingepland/getoond in de vaste
 * bedrijfstijdzone Europe/Brussels (zie o.a. de `timeZone`-optie bij elke
 * `toLocaleString` in de UI). Server actions draaien echter niet
 * noodzakelijk in die tijdzone (productie staat doorgaans op UTC), dus
 * `new Date(...)`/`getHours()`/`setHours()` — die impliciet de tijdzone van
 * het proces gebruiken — geven daar een fout tijdstip. Deze module rekent
 * expliciet in Europe/Brussels, ongeacht de tijdzone van de server.
 */
const TIMEZONE = "Europe/Brussels";

function partsOf(instant: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Offset (ms) tussen UTC en Europe/Brussels op het gegeven tijdstip (incl. zomer-/wintertijd). */
function brusselsOffsetMs(instant: Date) {
  const p = partsOf(instant);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - instant.getTime();
}

/** Zet wandklok-velden (jaar/maand/dag/uur/minuut) in Europe/Brussels om naar het overeenkomstige absolute tijdstip. */
function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0
): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return new Date(utcGuess.getTime() - brusselsOffsetMs(utcGuess));
}

/**
 * Parseert de waarde van een `<input type="datetime-local">`
 * (bv. "2026-09-01T12:00") als Europe/Brussels-lokale tijd — in
 * tegenstelling tot `new Date(value)`, die zo'n zoneloze string als lokale
 * tijd van de server interpreteert.
 */
export function parseLocalDateTime(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(value);
  if (!match) return new Date(value);
  const [, y, mo, d, h, mi, s] = match;
  return zonedTimeToUtc(Number(y), Number(mo), Number(d), Number(h), Number(mi), Number(s ?? 0));
}

/**
 * Combineert de Europe/Brussels-kalenderdag van `reference` met een zelf
 * gekozen "HH:MM"-tijdstip (bv. het einduur van een afspraak, dat dezelfde
 * dag moet blijven als het startuur).
 */
export function combineWithTimeOnSameLocalDay(reference: Date, hhmm: string): Date {
  const p = partsOf(reference);
  const [hour, minute] = hhmm.split(":").map(Number);
  return zonedTimeToUtc(p.year, p.month, p.day, hour, minute);
}

/** Formatteert een tijdstip als "HH:MM" in Europe/Brussels (bv. voor de automatische afspraaknaam). */
export function formatLocalTime(date: Date): string {
  return date.toLocaleTimeString("nl-BE", { timeStyle: "short", timeZone: TIMEZONE });
}
