export const FILE_CODES: Readonly<Record<string, string>> = {
  file_type_refused: 'Ce type de fichier n’est pas accepté : utilisez un PDF, un JPG ou un PNG.',
  file_too_large: 'Ce fichier dépasse la taille maximale de 10 Mo.',
  file_unsafe: 'Ce fichier a été refusé car il contient du code exécutable.',
  file_not_found: 'Ce fichier n’est plus disponible.',
  file_unavailable: 'Le contenu de ce fichier est momentanément introuvable : l’agence en a été avertie. Réessayez plus tard.',
};

export const SERVER_BUSY = 'Le service est momentanément indisponible. Réessayez dans un instant.';
