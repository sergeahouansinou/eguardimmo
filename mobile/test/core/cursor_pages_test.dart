import 'package:eguardimmo/core/utils/cursor_pages.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('liste complète : toutes les pages sont rassemblées', () async {
    final cursors = <String?>[];
    final items = await CursorPages.collect<int>((cursor) async {
      cursors.add(cursor);
      final page = cursors.length;
      return (items: [page], nextCursor: page < 3 ? 'c$page' : null);
    });
    expect(items, [1, 2, 3]);
    expect(cursors, [null, 'c1', 'c2']);
  });

  test('dernière page autorisée sans curseur : aucune erreur', () async {
    var calls = 0;
    final items = await CursorPages.collect<int>((cursor) async {
      calls++;
      return (
        items: [calls],
        nextCursor: calls < CursorPages.maxPages ? 'suite' : null,
      );
    });
    expect(items, hasLength(CursorPages.maxPages));
  });

  test(
    'curseur restant après la dernière page autorisée : erreur typée, jamais '
    'une liste tronquée en silence',
    () async {
      var calls = 0;
      await expectLater(
        CursorPages.collect<int>((cursor) async {
          calls++;
          return (items: [calls], nextCursor: 'suite');
        }),
        throwsA(
          isA<ListTruncatedException>().having(
            (e) => e.message,
            'message',
            contains('partielle'),
          ),
        ),
      );
      expect(calls, CursorPages.maxPages);
    },
  );
}
