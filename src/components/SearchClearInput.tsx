"use client";

/**
 * Drop-in vervanging voor `<input type="search">` binnen een gewoon
 * `<form method="GET">` (zoals Klanten/Subagent/Polissen/Pipeline): de
 * ingebouwde "X"-knop van een zoekveld wist enkel de tekst zelf, zonder het
 * formulier opnieuw te versturen — de vorige `?q=...`-filter bleef daardoor
 * actief tot de pagina manueel ververst of opnieuw Enter gedrukt werd.
 * Verstuurt het omvattende formulier hier daarom automatisch zodra het veld
 * leeg wordt (via de "X", backspace, of selecteren + verwijderen).
 */
export function SearchClearInput({
  name,
  defaultValue,
  placeholder,
  className,
}: {
  name: string;
  defaultValue: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type="search"
      name={name}
      defaultValue={defaultValue}
      placeholder={placeholder}
      className={className}
      onChange={(e) => {
        if (e.target.value === "") {
          e.currentTarget.form?.requestSubmit();
        }
      }}
    />
  );
}
