import { Logo } from "@/components/Logo";

/**
 * Merkkopband bovenaan de export-tabellen op /productie: enkel bedoeld om
 * het geëxporteerde beeld (ExportImageButton, via html-to-image) er
 * posterachtig te laten uitzien i.p.v. een kale tabel — staat om diezelfde
 * reden ook gewoon zichtbaar op de pagina zelf (wat je ziet is exact wat je
 * exporteert, i.p.v. een apart verborgen element proberen vastleggen).
 * Inline hex-kleuren i.p.v. Tailwind-kleurklassen, zelfde reden als
 * percentBadgeStyle in ProductionShared.tsx: betrouwbaar bij het
 * rasteren voor export.
 */
export function CijfersPosterHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  const generatedAt = new Date().toLocaleDateString("nl-BE", {
    dateStyle: "long",
    timeZone: "Europe/Brussels",
  });

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 px-6 py-5"
      style={{ background: "linear-gradient(135deg, #0f2a52 0%, #2f5fa8 100%)" }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center rounded-lg px-3 py-2"
          style={{ background: "#ffffff" }}
        >
          <Logo size={56} />
        </div>
        <div>
          <p className="text-lg font-semibold" style={{ color: "#ffffff" }}>
            {title}
          </p>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
            {subtitle}
          </p>
        </div>
      </div>
      <p className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
        Bijgewerkt: {generatedAt}
      </p>
    </div>
  );
}
