/**
 * Herkenbare `source`-waarde voor leads die via de Excel-upload ("Klanten in
 * bulk toevoegen", zie customerImport.ts) aangemaakt zijn — achteraf
 * ingevoerde historische klanten, geen nieuw aangebrachte leads. De
 * Aanbevelingen/ABV-cijfers (zie production.ts) sluiten leads met deze
 * source uit, zodat een bulk-import geen "nieuwe aanbevelingen" lijkt op te
 * leveren. Puur/synchroon, dus in een apart bestand i.p.v. customerImport.ts
 * of production.ts ("use server" staat enkel async server actions toe).
 */
export const BULK_EXCEL_IMPORT_SOURCE = "Bulk-import (Excel)";
