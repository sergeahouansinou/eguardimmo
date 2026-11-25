export const annoncesPaths = {
  list: "/annonces",
  create: "/annonces/nouvelle",
} as const;

export function listingHref(id: string): string {
  return `${annoncesPaths.list}/${encodeURIComponent(id)}`;
}

export function editListingHref(id: string): string {
  return `${listingHref(id)}/modifier`;
}
