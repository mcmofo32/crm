"use client";

import { useRef, useState } from "react";

type NominatimAddress = {
  house_number?: string;
  road?: string;
  postcode?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
};

type Suggestion = { display_name: string; address?: NominatimAddress };

/** Bouwt "Straat nummer, postcode Stad" op uit Nominatims structured address — Nominatims eigen `display_name` bevat te veel (wijk, provincie, land) om als adres bruikbaar te zijn. */
function formatShortAddress(suggestion: Suggestion): string {
  const address = suggestion.address;
  if (!address) return suggestion.display_name;
  const street = [address.road, address.house_number].filter(Boolean).join(" ");
  const city = address.city ?? address.town ?? address.village ?? address.municipality;
  const cityLine = [address.postcode, city].filter(Boolean).join(" ");
  return [street, cityLine].filter(Boolean).join(", ") || suggestion.display_name;
}

/**
 * Tekstveld voor een adres met suggesties uit OpenStreetMap/Nominatim (gratis,
 * geen API-key nodig) om typfouten te vermijden. Valt gewoon terug op een
 * normaal tekstveld als de suggestieservice niet bereikbaar is.
 */
export function AddressAutocomplete({
  value,
  onChange,
  name,
  placeholder,
  required,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Zet dit om het veld als gewoon formulierveld (via FormData) te laten meesturen. */
  name?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  function handleChange(next: string) {
    onChange(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const query = next.trim();
    if (query.length < 4) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const requestId = ++requestIdRef.current;
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=be&q=${encodeURIComponent(query)}`
        );
        if (!res.ok || requestId !== requestIdRef.current) return;
        const data: Suggestion[] = await res.json();
        if (requestId === requestIdRef.current) {
          setSuggestions(data);
          setOpen(data.length > 0);
        }
      } catch {
        // Adres-suggesties zijn een hulpmiddel, geen vereiste — manueel
        // typen blijft altijd werken als de suggestieservice faalt.
      }
    }, 400);
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setOpen(suggestions.length > 0)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        className={className}
      />
      {name && <input type="hidden" name={name} value={value} />}
      {open && (
        <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-md border border-slate-300 bg-white text-sm shadow-lg">
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(formatShortAddress(s));
                  setSuggestions([]);
                  setOpen(false);
                }}
                className="block w-full px-3 py-2 text-left hover:bg-slate-100"
              >
                {formatShortAddress(s)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
