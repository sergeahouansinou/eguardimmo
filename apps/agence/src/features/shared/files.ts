export interface FileRules {
  maxBytes: number;
  extensions: readonly string[];
  mimeTypes: readonly string[];
}

export const MB = 1024 * 1024;

export const DOCUMENT_RULES: FileRules = {
  maxBytes: 25 * MB,
  extensions: ["pdf", "doc", "docx", "jpg", "jpeg", "png"],
  mimeTypes: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png",
  ],
};

export const IMAGE_RULES: FileRules = {
  maxBytes: 2 * MB,
  extensions: ["png", "jpg", "jpeg"],
  mimeTypes: ["image/png", "image/jpeg"],
};

export const PHOTO_RULES: FileRules = {
  maxBytes: 10 * MB,
  extensions: ["png", "jpg", "jpeg"],
  mimeTypes: ["image/png", "image/jpeg"],
};

export interface FileInfo {
  name: string;
  size: number;
  type: string;
}

export function validateFile(file: FileInfo, rules: FileRules): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!rules.extensions.includes(extension) || (file.type !== "" && !rules.mimeTypes.includes(file.type))) {
    return `Format non accepté. Formats autorisés : ${rules.extensions.join(", ").toUpperCase()}.`;
  }
  if (file.size === 0) return "Le fichier est vide.";
  if (file.size > rules.maxBytes) return `Fichier trop volumineux (${String(Math.round(rules.maxBytes / MB))} Mo au maximum).`;
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes >= MB) return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(bytes / MB)} Mo`;
  return `${String(Math.max(1, Math.round(bytes / 1024)))} Ko`;
}
