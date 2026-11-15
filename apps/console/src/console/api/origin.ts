export function consoleOrigin(): string {
  // Rendu serveur : aucune requête ne part avant le montage, l'origine réelle est lue dans le navigateur.
  return typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
}
