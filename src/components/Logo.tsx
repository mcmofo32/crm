/**
 * Beeldmerk van "Structuur A": marineblauw vierkant met de wordmark
 * "STRUCTUUR" en een lichtblauwe "A" — nagetekend als SVG (i.p.v. een los
 * beeldbestand) zodat het op elk formaat scherp blijft.
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
      <rect width="64" height="64" fill="#0f2a52" />
      <text
        x="32"
        y="28"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="700"
        fontSize="7.5"
        letterSpacing="1"
        fill="#ffffff"
      >
        STRUCTUUR
      </text>
      <line x1="22" y1="34" x2="42" y2="34" stroke="#5b7fb5" strokeWidth="0.75" />
      <text
        x="32"
        y="53"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="800"
        fontSize="20"
        fill="#8ab4f8"
      >
        A
      </text>
    </svg>
  );
}
