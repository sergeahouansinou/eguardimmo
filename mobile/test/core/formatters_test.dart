import 'package:eguardimmo/core/utils/formatters.dart';
import 'package:eguardimmo/core/utils/idempotency_key.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

void main() {
  setUpAll(() => initializeDateFormatting('fr_FR'));

  test('les montants sont lus en unités mineures', () {
    expect(Formatters.money(14800, currency: 'EUR'), contains('148,00'));
    expect(Formatters.moneyCompact(7400, currency: 'EUR'), contains('74'));
    expect(
      Formatters.moneyCompact(7400, currency: 'EUR'),
      isNot(contains(',')),
    );
    expect(Formatters.moneyCompact(7450, currency: 'EUR'), contains('74,50'));
  });

  test('le FCFA n’a pas de décimales', () {
    expect(Formatters.decimalsFor('XOF'), 0);
    expect(Formatters.money(25000, currency: 'XOF'), isNot(contains(',')));
  });

  test('plage de dates et date ISO', () {
    expect(
      Formatters.dateRange(DateTime(2026, 12, 12), DateTime(2026, 12, 14)),
      '12 au 14 déc. 2026',
    );
    expect(Formatters.isoDate(DateTime(2026, 3, 4)), '2026-03-04');
  });

  test('la clé d’idempotence est un UUID v4 distinct à chaque appel', () {
    final a = IdempotencyKey.generate();
    final b = IdempotencyKey.generate();
    expect(
      a,
      matches(
        RegExp(
          r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
        ),
      ),
    );
    expect(a, isNot(b));
    expect(a.length, inInclusiveRange(8, 120));
  });

  test('taille de fichier en o, Ko puis Mo', () {
    expect(Formatters.fileSize(512), '512 o');
    expect(Formatters.fileSize(245760), '240 Ko');
    expect(Formatters.fileSize(10 * 1024 * 1024), '10 Mo');
    expect(Formatters.fileSize(1536 * 1024), '1,5 Mo');
  });

  test('date courte : l’heure le jour même, sinon le jour', () {
    final now = DateTime(2026, 11, 20, 18);
    expect(
      Formatters.shortDateTime(DateTime(2026, 11, 20, 9, 5), now: now),
      '09:05',
    );
    expect(
      Formatters.shortDateTime(DateTime(2026, 11, 3, 9, 5), now: now),
      contains('3'),
    );
    expect(
      Formatters.shortDateTime(DateTime(2025, 11, 3, 9, 5), now: now),
      contains('2025'),
    );
  });
}
