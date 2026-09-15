/**
 * URL naar de geüploade profielfoto van een gebruiker, of `null` als die er
 * geen heeft (dan valt de Avatar-component terug op initialen). `?v=` is een
 * cache-buster op basis van de laatste upload, zodat een nieuwe foto niet
 * door een oude gecachete versie verborgen blijft.
 */
export function avatarUrl(user: {
  id: string;
  avatarUpdatedAt: Date | null;
}): string | null {
  return user.avatarUpdatedAt
    ? `/api/users/${user.id}/avatar?v=${user.avatarUpdatedAt.getTime()}`
    : null;
}
