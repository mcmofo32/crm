import { Camera } from "lucide-react";
import type { AcademyBlock } from "@/lib/academy-types";
import { renderInline } from "./inline";

/** Rendert alle blokken van één hoofdstuk. De schermafbeelding-teller wordt
 * lokaal per render opgebouwd (geen module-level mutable state) — anders
 * zou die op een Node-server blijven doortellen over verschillende
 * requests/gebruikers heen in plaats van per pagina-render opnieuw te
 * beginnen bij 1. */
export function AcademyBlocks({ blocks }: { blocks: AcademyBlock[] }) {
  // Puur afgeleid (geen mutatie): het n-de "shot"-blok krijgt nummer n.
  const shotNumbers = blocks.map(
    (_, i) => blocks.slice(0, i + 1).filter((b) => b[0] === "shot").length
  );
  return (
    <div className="max-w-[88ch] space-y-4 text-[15px] leading-relaxed text-slate-700">
      {blocks.map((block, i) => (
        <AcademyBlockView key={i} block={block} shotNumber={shotNumbers[i]} />
      ))}
    </div>
  );
}

function AcademyBlockView({
  block,
  shotNumber,
}: {
  block: AcademyBlock;
  shotNumber: number;
}) {
  const kind = block[0];

  if (kind === "p") {
    return <p>{renderInline(block[1])}</p>;
  }

  if (kind === "h3") {
    return (
      <h3 className="!mt-8 text-lg font-semibold text-slate-900">
        {renderInline(block[1])}
      </h3>
    );
  }

  if (kind === "list") {
    return (
      <ul className="list-disc space-y-1.5 pl-5">
        {block[1].map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>
    );
  }

  if (kind === "steps") {
    return (
      <ol className="list-decimal space-y-1.5 pl-5">
        {block[1].map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ol>
    );
  }

  if (kind === "note") {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        {renderInline(block[1])}
      </div>
    );
  }

  if (kind === "warn") {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {renderInline(block[1])}
      </div>
    );
  }

  if (kind === "photo") {
    const [, filename, caption, desc] = block;
    return (
      <figure className="space-y-2">
        {/* Vaste, wisselende schermafbeeldingen uit het CRM zelf (geen
            externe/onbekende afmetingen) — plain <img>, zelfde patroon als
            Avatar.tsx en de incentive-poster elders in de app. */}
        <img
          src={`/academy/${filename}`}
          alt={caption}
          className="w-full rounded-lg border border-slate-200 shadow-sm"
        />
        <figcaption>
          <p className="font-semibold text-slate-900">{caption}</p>
          <p className="text-sm text-slate-500">{desc}</p>
        </figcaption>
      </figure>
    );
  }

  if (kind === "shot") {
    const [, caption, desc] = block;
    return (
      <div className="flex gap-3 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-3.5">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400">
          <Camera size={17} />
        </span>
        <div>
          <p className="mb-0.5 font-semibold text-slate-900">
            <span className="mr-2 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide text-slate-400">
              Schermafbeelding {shotNumber}
            </span>
            {caption}
          </p>
          <p className="text-sm text-slate-500">{desc}</p>
        </div>
      </div>
    );
  }

  if (kind === "table") {
    const [, headers, rows] = block;
    return (
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="whitespace-nowrap px-3.5 py-2.5">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3.5 py-2.5 align-top">
                    {renderInline(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return null;
}
