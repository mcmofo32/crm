/**
 * Typen voor de Academy-cursusinhoud (src/lib/academy-content.json), 1-op-1
 * gegenereerd uit de Python-inhoud die ook de externe PDF/webversie voedt —
 * zie het "Structuur A Academy"-project. Blok-vorm komt overeen met wat daar
 * "p"/"h3"/"list"/"steps"/"note"/"warn"/"photo"/"table" heet.
 */

export type AcademyBlock =
  | ["p", string]
  | ["h3", string]
  | ["list", string[]]
  | ["steps", string[]]
  | ["note", string]
  | ["warn", string]
  | ["photo", string, string, string] // filename, caption, desc
  | ["shot", string, string] // caption, desc — bewust nog geen echte foto
  | ["table", string[], string[][]]; // headers, rows

export type AcademyChapter = {
  id: string;
  num: string;
  title: string;
  audience: string | null;
  blocks: AcademyBlock[];
};

export type AcademyContent = {
  courseTitle: string;
  courseSubtitle: string;
  chapters: AcademyChapter[];
};
