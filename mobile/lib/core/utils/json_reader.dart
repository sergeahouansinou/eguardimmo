/// Lecture stricte d'une réponse JSON : un type inattendu lève une
/// FormatException au lieu de produire une valeur par défaut qui masque la panne.
abstract final class Json() {
  static Map<String, Object?> object(Object? value, String where) {
    if (value is Map<String, Object?>) return value;
    throw FormatException('$where : objet attendu');
  }

  static List<Object?> list(Object? value, String where) {
    if (value is List<Object?>) return value;
    throw FormatException('$where : liste attendue');
  }

  static Map<String, Object?> data(Object? body, String where) =>
      object(object(body, where)['data'], '$where.data');

  static List<Object?> dataList(Object? body, String where) =>
      list(object(body, where)['data'], '$where.data');

  static String string(Map<String, Object?> json, String key) {
    final value = json[key];
    if (value is String) return value;
    throw FormatException('« $key » : texte attendu');
  }

  static String? stringOrNull(Map<String, Object?> json, String key) {
    final value = json[key];
    if (value == null) return null;
    if (value is String) return value;
    throw FormatException('« $key » : texte ou null attendu');
  }

  static int integer(Map<String, Object?> json, String key) {
    final value = json[key];
    if (value is int) return value;
    throw FormatException('« $key » : entier attendu');
  }

  static int? integerOrNull(Map<String, Object?> json, String key) {
    final value = json[key];
    if (value == null) return null;
    if (value is num && value == value.roundToDouble()) return value.toInt();
    throw FormatException('« $key » : entier ou null attendu');
  }

  static bool boolean(Map<String, Object?> json, String key) {
    final value = json[key];
    if (value is bool) return value;
    throw FormatException('« $key » : booléen attendu');
  }

  static List<String> strings(Map<String, Object?> json, String key) {
    final value = json[key];
    if (value is List<Object?> && value.every((item) => item is String)) {
      return value.cast<String>();
    }
    throw FormatException('« $key » : liste de textes attendue');
  }

  static Map<String, Object?> child(Map<String, Object?> json, String key) =>
      object(json[key], key);

  static Map<String, Object?>? childOrNull(
    Map<String, Object?> json,
    String key,
  ) => json[key] == null ? null : object(json[key], key);

  static DateTime date(Map<String, Object?> json, String key) {
    final text = string(json, key);
    final parsed = DateTime.tryParse(text);
    if (parsed == null) throw FormatException('« $key » : date invalide');
    return parsed;
  }

  /// Jour calendaire `AAAA-MM-JJ`, sans heure ni fuseau.
  static DateTime day(Map<String, Object?> json, String key) {
    final text = string(json, key);
    if (!RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(text)) {
      throw FormatException('« $key » : date AAAA-MM-JJ attendue');
    }
    return DateTime.parse(text);
  }

  static DateTime? dateOrNull(Map<String, Object?> json, String key) =>
      json[key] == null ? null : date(json, key);
}
