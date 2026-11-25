/// Un identifiant inséré dans un chemin d'API doit être un UUID : ni `..`,
/// ni `/`, ni `?` ne peuvent réorienter la requête.
abstract final class PathIds() {
  static final RegExp _uuid = RegExp(
    r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
  );
  static final RegExp _segment = RegExp(r'^[A-Za-z0-9-]{1,64}$');

  static String uuid(String value) {
    if (!_uuid.hasMatch(value)) {
      throw const FormatException('Identifiant invalide');
    }
    return value;
  }

  /// Identifiant opaque du serveur (UUID, organisation) : lettres, chiffres
  /// et tirets seulement, 64 caractères au plus.
  static String segment(String value) {
    if (!_segment.hasMatch(value)) {
      throw const FormatException('Identifiant invalide');
    }
    return value;
  }
}
