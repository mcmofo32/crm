/**
 * Beeldmerk van "Structuur A": marineblauwe wordmark "STRUCTUUR" met "A"
 * eronder, zonder eigen achtergrond — bedoeld om op de witte pagina-
 * achtergrond te staan (header, inlogpagina, ...). Nagetekend als SVG
 * (i.p.v. een los beeldbestand) zodat het op elk formaat scherp blijft.
 */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
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
        fill="#0f2a52"
      >
        STRUCTUUR
      </text>
      <line x1="22" y1="34" x2="42" y2="34" stroke="#2f5fa8" strokeWidth="0.75" />
      <text
        x="32"
        y="53"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="800"
        fontSize="20"
        fill="#0f2a52"
      >
        A
      </text>
    </svg>
  );
}
