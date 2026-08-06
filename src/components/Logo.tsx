/**
 * Beeldmerk van "Structuur A": marineblauw vierkant met gouden kroon en een
 * witte "A" — nagetekend als SVG (i.p.v. een los beeldbestand) zodat het op
 * elk formaat scherp blijft.
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
      <rect width="64" height="64" rx="12" fill="#0f2a52" />
      <path
        d="M14 24 L20 14 L26 21 L32 12 L38 21 L44 14 L50 24 L50 29 L14 29 Z"
        fill="#d9a94a"
      />
      <text
        x="32"
        y="49"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="800"
        fontSize="26"
        fill="#ffffff"
      >
        A
      </text>
    </svg>
  );
}
