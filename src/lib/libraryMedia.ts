/**
 * Video's in de Bibliotheek zijn "enkel bekijken": ze worden in de CRM zelf
 * afgespeeld (via /api/library/stream/[id]) en nooit als download
 * aangeboden — /api/library/download/[id] weigert ze ook expliciet.
 */
export function isViewOnlyLibraryMimeType(mimeType: string) {
  return mimeType.startsWith("video/");
}
