export const sebookKeys = {
  me: ["sebook", "me"] as const,
  places: (query: string) => ["sebook", "places", query] as const,
  favorites: ["sebook", "favorites"] as const,
  bookings: ["sebook", "bookings"] as const,
  listing: (ref: string) => ["sebook", "listing", ref] as const,
  availability: (ref: string, from: string, to: string) => ["sebook", "availability", ref, from, to] as const,
  quote: (ref: string, checkIn: string, checkOut: string, guests: number) => ["sebook", "quote", ref, checkIn, checkOut, guests] as const,
};
