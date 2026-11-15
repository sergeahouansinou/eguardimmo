import { nextId } from '../../outils/kit';

export interface FileRules {
  extensions: readonly string[];
  mimes: readonly string[];
  maxBytes: number;
  maxFiles: number;
}

export interface PickedFile {
  id: string;
  name: string;
  sizeBytes: number;
}

export interface Rejection {
  name: string;
  reason: string;
}

export function formatSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;
  if (bytes >= 1_000) return `${String(Math.round(bytes / 1_000))} Ko`;
  return `${String(bytes)} o`;
}

function printable(text: string): string {
  let result = '';
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) >= 32) result += text.charAt(index);
  }
  return result;
}

const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
};

// Seules les métadonnées du fichier sont lues : aucun contenu n'est ouvert côté client.
export function pickFiles(
  incoming: readonly File[],
  existing: readonly PickedFile[],
  rules: FileRules,
  typeLabel: string,
): { accepted: PickedFile[]; rejected: Rejection[] } {
  const accepted: PickedFile[] = [];
  const rejected: Rejection[] = [];
  const known = [...existing];
  for (const file of incoming) {
    const name = printable(file.name.replace(/[\\/]/g, '_')).slice(0, 255);
    const typeOk = rules.extensions.includes(extensionOf(name)) && (file.type === '' || rules.mimes.includes(file.type));
    if (name === '') rejected.push({ name: 'Fichier sans nom', reason: 'nom de fichier absent' });
    else if (!typeOk) rejected.push({ name, reason: `type non pris en charge (${typeLabel})` });
    else if (file.size > rules.maxBytes) rejected.push({ name, reason: `dépasse ${formatSize(rules.maxBytes)}` });
    else if (file.size === 0) rejected.push({ name, reason: 'fichier vide' });
    else if (known.some((item) => item.name === name && item.sizeBytes === file.size)) rejected.push({ name, reason: 'déjà ajouté' });
    else if (known.length >= rules.maxFiles) rejected.push({ name, reason: `limite de ${String(rules.maxFiles)} fichiers atteinte` });
    else {
      const picked = { id: nextId('fichier'), name, sizeBytes: file.size };
      accepted.push(picked);
      known.push(picked);
    }
  }
  return { accepted, rejected };
}
