/**
 * Beeldmerk van "Structuur A": marineblauwe wordmark "STRUCTUUR" met "A"
 * eronder, zonder eigen achtergrond — bedoeld om op de witte pagina-
 * achtergrond te staan (header, inlogpagina, ...). Nagetekend als SVG
 * (i.p.v. een los beeldbestand) zodat het op elk formaat scherp blijft.
 *
 * viewBox is verticaal bijgeknipt tot net rond de tekst (i.p.v. het volle
 * 64x64-vierkant) zodat er geen witruimte boven/onder overblijft — `size`
 * bepaalt daardoor de breedte, met de hoogte proportioneel daaraan.
 *
 * `themed`: laat het logo in donkere modus wit i.p.v. marineblauw renderen.
 * Bewust opt-in (i.p.v. altijd via de globale .dark-klasse) — enkel
 * gebruiken op plekken die zelf al volledig dark-mode-gestyled zijn.
 *
 * `color`: forceert een vaste kleur (hex) via inline SVG-attributen i.p.v.
 * een Tailwind-klasse, en overschrijft `themed`. Nodig op plekken die
 * betrouwbaar via html-to-image geëxporteerd moeten worden (zie
 * CijfersPosterHeader) — class-based SVG fill/stroke valt daar soms weg
 * omdat de rasterizer de Tailwind-stylesheet niet altijd meeneemt.
 */
const VIEWBOX_HEIGHT = 42;
const VIEWBOX_WIDTH = 64;

export function Logo({
  size = 32,
  themed = false,
  color,
}: {
  size?: number;
  themed?: boolean;
  color?: string;
}) {
  const textClassName = color ? undefined : themed ? "fill-[#0f2a52] dark:fill-white" : "fill-[#0f2a52]";
  const lineClassName = color ? undefined : themed ? "stroke-[#2f5fa8] dark:stroke-white" : "stroke-[#2f5fa8]";
  return (
    <svg
      width={size}
      height={size * (VIEWBOX_HEIGHT / VIEWBOX_WIDTH)}
      viewBox={`0 16 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <text
        x="32"
        y="28"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="700"
        fontSize="7.5"
        letterSpacing="1"
        className={textClassName}
        fill={color}
      >
        STRUCTUUR
      </text>
      <line
        x1="22"
        y1="34"
        x2="42"
        y2="34"
        strokeWidth="0.75"
        className={lineClassName}
        stroke={color}
      />
      <text
        x="32"
        y="53"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="800"
        fontSize="20"
        className={textClassName}
        fill={color}
      >
        A
      </text>
    </svg>
  );
}
