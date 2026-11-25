/// Un fichier téléchargé que l'application refuse d'ouvrir (type, taille ou
/// contenu non conformes). Le message est destiné à l'utilisateur.
class const FileRejectedException(final String message) implements Exception {
  @override
  String toString() => 'FileRejectedException: $message';
}
