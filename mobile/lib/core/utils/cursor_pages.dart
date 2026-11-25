import 'json_reader.dart';

/// Le serveur a encore des pages après le plafond : la liste serait partielle.
class const ListTruncatedException({
  final String message =
      'Liste partielle : trop d’éléments pour être affichés en entier. '
      'Réessayez plus tard ou consultez le site.',
}) implements Exception {
  @override
  String toString() => 'ListTruncatedException: $message';
}

typedef CursorPage<T> = ({List<T> items, String? nextCursor});

/// Lecture complète d'une liste paginée par curseur (`meta.next_cursor`).
/// Plafond de pages : une API qui ne termine jamais ne fige pas l'application,
/// et une liste plus longue que le plafond échoue (ListTruncatedException)
/// au lieu d'être tronquée en silence.
abstract final class CursorPages() {
  static const pageSize = 100;
  static const maxPages = 10;

  static CursorPage<T> parse<T>(
    Object? body,
    String where,
    T Function(Map<String, Object?> entry) read,
  ) {
    final root = Json.object(body, where);
    return (
      items: [
        for (final entry in Json.dataList(root, where))
          read(Json.object(entry, where)),
      ],
      nextCursor: Json.stringOrNull(Json.child(root, 'meta'), 'next_cursor'),
    );
  }

  static Future<List<T>> collect<T>(
    Future<CursorPage<T>> Function(String? cursor) fetch,
  ) async {
    final all = <T>[];
    String? cursor;
    for (var page = 0; page < maxPages; page++) {
      final result = await fetch(cursor);
      all.addAll(result.items);
      cursor = result.nextCursor;
      if (cursor == null) return all;
    }
    throw const ListTruncatedException();
  }
}
