const MAX_LENGTH = 2048;

function hasForbiddenCharacter(href: string): boolean {
  for (const char of href) {
    const code = char.codePointAt(0) ?? 0;
    if (code <= 0x20 || code === 0x7f || char === '\\') return true;
  }
  return false;
}

// Le lien vient du serveur mais n'est suivi que s'il reste dans l'application : une URL externe,
// `javascript:`, un `//hôte` ou un antislash (lu comme `/` par les navigateurs) est écarté.
export function internalHref(href: string | null): string | null {
  if (href === null || href.length > MAX_LENGTH) return null;
  if (!href.startsWith('/') || href.startsWith('//') || hasForbiddenCharacter(href)) return null;
  return href;
}
