import { Fragment } from "react";

/** Zelfde regex/logica als de Python `inline.py` die de PDF/webversie voedt. */
const TOKEN_RE = /(\*\*.+?\*\*|`.+?`)/g;

/** Rendert `**vet**` en `` `code` `` binnen tekst als React-nodes. */
export function renderInline(text: string): React.ReactNode {
  const parts = text.split(TOKEN_RE).filter((p) => p !== "");
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={i}
              className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] dark:bg-slate-800 dark:text-slate-200"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}
