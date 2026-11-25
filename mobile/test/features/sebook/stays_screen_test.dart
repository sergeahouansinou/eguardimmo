import 'dart:ui' show Size;

import 'package:eguardimmo/core/utils/formatters.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';
import '../../helpers/fixtures.dart';
import '../../helpers/harness.dart';

String _inDays(int days) =>
    Formatters.isoDate(DateTime.now().add(Duration(days: days)));

FakeHandler _handler({bool cancelled = false, int? cancelStatus}) {
  var isCancelled = cancelled;
  return (call) {
    if (call.method == 'POST' && call.path.endsWith('/cancel')) {
      if (cancelStatus != null) {
        return problem(
          cancelStatus,
          'booking_not_cancellable',
          'Cette réservation ne peut plus être annulée : elle est déjà annulée ou terminée, ou le séjour a commencé.',
        );
      }
      isCancelled = true;
      return {
        'data': Fixtures.booking(
          id: 'b1',
          status: 'cancelled',
          checkIn: _inDays(40),
          checkOut: _inDays(42),
        )..['refund'] = Fixtures.money(15300),
      };
    }
    if (call.path == '/marketplace/bookings') {
      return Fixtures.page([
        Fixtures.booking(
          id: 'b1',
          status: isCancelled ? 'cancelled' : 'pending_payment',
          checkIn: _inDays(40),
          checkOut: _inDays(42),
        ),
        Fixtures.booking(
          id: 'b3',
          status: 'completed',
          checkIn: _inDays(-60),
          checkOut: _inDays(-56),
          reference: 'SB-2026-001755',
        ),
      ]);
    }
    return null;
  };
}

void main() {
  testWidgets(
    'pending_payment : « Paiement à finaliser », jamais « Confirmée »',
    (tester) async {
      await pumpApp(tester, handler: _handler(), location: '/sejours');

      expect(find.text('Mes réservations'), findsOneWidget);
      expect(find.text('Paiement à finaliser'), findsOneWidget);
      expect(find.text('Confirmée'), findsNothing);
      expect(
        find.textContaining('paiement en ligne n’est pas encore ouvert'),
        findsOneWidget,
      );
      expect(find.text('Annuler'), findsOneWidget);
    },
  );

  testWidgets('pending_payment : échéance du paiement affichée', (
    tester,
  ) async {
    await pumpApp(
      tester,
      handler: (call) => call.path == '/marketplace/bookings'
          ? Fixtures.page([
              Fixtures.booking(
                checkIn: _inDays(40),
                checkOut: _inDays(42),
                expiresAt: '2099-01-01T10:30:00+00:00',
              ),
            ])
          : null,
      location: '/sejours',
    );
    expect(
      find.textContaining('les dates sont libérées le 1 janv. 2099'),
      findsOneWidget,
    );
  });

  testWidgets('annonce retirée : réservation affichée sans titre', (
    tester,
  ) async {
    await pumpApp(
      tester,
      handler: (call) => call.path == '/marketplace/bookings'
          ? Fixtures.page([
              Fixtures.booking(
                checkIn: _inDays(40),
                checkOut: _inDays(42),
                withListing: false,
              ),
            ])
          : null,
      location: '/sejours',
    );
    expect(find.text('Annonce indisponible'), findsOneWidget);
    expect(find.text('Paiement à finaliser'), findsOneWidget);
  });

  testWidgets('onglet Passées : réservation terminée sans bouton Annuler', (
    tester,
  ) async {
    await pumpApp(tester, handler: _handler(), location: '/sejours');
    await tester.tap(find.text('Passées'));
    await tester.pumpAndSettle();

    expect(find.text('Terminée'), findsOneWidget);
    expect(find.text('Annuler'), findsNothing);
    expect(find.text('Paiement à finaliser'), findsNothing);
  });

  testWidgets('annulation : confirmation, POST, remboursement annoncé', (
    tester,
  ) async {
    final app = await pumpApp(
      tester,
      handler: _handler(),
      location: '/sejours',
    );
    await tester.tap(find.text('Annuler'));
    await tester.pumpAndSettle();
    expect(find.text('Annuler cette réservation ?'), findsOneWidget);
    expect(app.api.calls.where((c) => c.method == 'POST'), isEmpty);

    await tester.tap(find.text('Annuler la réservation'));
    await tester.pumpAndSettle();

    expect(
      app.api.calls.where(
        (c) =>
            c.method == 'POST' && c.path == '/marketplace/bookings/b1/cancel',
      ),
      hasLength(1),
    );
    expect(
      find.textContaining('Réservation annulée. Remboursement calculé'),
      findsOneWidget,
    );
    expect(find.text('Annulée'), findsOneWidget);
  });

  testWidgets('annulation : « Conserver » ne déclenche aucun appel', (
    tester,
  ) async {
    final app = await pumpApp(
      tester,
      handler: _handler(),
      location: '/sejours',
    );
    await tester.tap(find.text('Annuler'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Conserver'));
    await tester.pumpAndSettle();

    expect(app.api.calls.where((c) => c.method == 'POST'), isEmpty);
    expect(find.text('Paiement à finaliser'), findsOneWidget);
  });

  testWidgets('annulation refusée : message du serveur affiché', (
    tester,
  ) async {
    await pumpApp(
      tester,
      handler: _handler(cancelStatus: 409),
      location: '/sejours',
    );
    await tester.tap(find.text('Annuler'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Annuler la réservation'));
    await tester.pumpAndSettle();

    expect(find.textContaining('ne peut plus être annulée'), findsOneWidget);
  });

  testWidgets(
    'déconnecté : invitation à se connecter, aucun appel réservations',
    (tester) async {
      final app = await pumpApp(
        tester,
        handler: _handler(),
        location: '/sejours',
        signedIn: false,
      );
      expect(find.text('Connexion requise'), findsOneWidget);
      expect(find.text('Se connecter'), findsOneWidget);
      expect(
        app.api.calls.where((c) => c.path == '/marketplace/bookings'),
        isEmpty,
      );
    },
  );

  testWidgets('pas de débordement à 320 px, texte à 200 %', (tester) async {
    await pumpApp(
      tester,
      handler: _handler(),
      location: '/sejours',
      size: const Size(320, 900),
      textScale: 2,
    );
    expect(tester.takeException(), isNull);
  });
}
