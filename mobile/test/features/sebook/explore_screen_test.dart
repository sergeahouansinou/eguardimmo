import 'dart:ui' show Size;

import 'package:eguardimmo/core/routes/app_routes.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';
import '../../helpers/fixtures.dart';
import '../../helpers/harness.dart';

Object? _explore(RecordedCall call) {
  if (call.path == '/marketplace/listings') {
    return Fixtures.listingsPage([
      Fixtures.listing(),
      Fixtures.listing(ref: 't4w6y8z2c5hd', title: 'Loft vue Saône'),
    ]);
  }
  if (call.path == '/marketplace/favorites') return Fixtures.page([]);
  return null;
}

void main() {
  testWidgets(
    'affiche les annonces issues de l’API et la barre de navigation',
    (tester) async {
      await pumpApp(tester, handler: _explore);

      expect(find.text('Studio lumineux, Presqu’île'), findsOneWidget);
      expect(find.text('Loft vue Saône'), findsOneWidget);
      for (final label in ['Explorer', 'Séjours', 'Messages', 'Compte']) {
        expect(find.text(label), findsWidgets);
      }
    },
  );

  testWidgets('annonce sans ville ni hôte : carte affichée', (tester) async {
    await pumpApp(
      tester,
      handler: (call) => call.path == '/marketplace/listings'
          ? Fixtures.listingsPage([
              Fixtures.listing(city: null, hostName: null),
            ])
          : _explore(call),
    );
    expect(tester.takeException(), isNull);
    expect(find.text('Studio lumineux, Presqu’île'), findsOneWidget);
  });

  testWidgets('liste vide : message dédié', (tester) async {
    await pumpApp(
      tester,
      handler: (call) => call.path == '/marketplace/listings'
          ? Fixtures.listingsPage([])
          : _explore(call),
    );
    expect(find.text('Aucune annonce'), findsOneWidget);
  });

  testWidgets('échec réseau puis reprise', (tester) async {
    var fail = true;
    await pumpApp(
      tester,
      handler: (call) {
        if (call.path == '/marketplace/listings' && fail) {
          return networkFailure();
        }
        return _explore(call);
      },
    );
    expect(find.textContaining('Connexion impossible'), findsOneWidget);

    fail = false;
    await tester.tap(find.text('Réessayer'));
    await tester.pumpAndSettle();
    expect(find.text('Loft vue Saône'), findsOneWidget);
  });

  testWidgets('déconnecté : le cœur mène à la connexion, sans appel favoris', (
    tester,
  ) async {
    final app = await pumpApp(tester, handler: _explore, signedIn: false);
    await tester.tap(
      find.byTooltip('Ajouter aux favoris : Studio lumineux, Presqu’île'),
    );
    await tester.pumpAndSettle();

    expect(app.router.state.uri.path, AppRoutes.login);
    expect(
      app.api.calls.where((c) => c.path == '/marketplace/favorites'),
      isEmpty,
    );
  });

  testWidgets('pas de débordement à 320 px avec texte agrandi', (tester) async {
    await pumpApp(
      tester,
      handler: _explore,
      size: const Size(320, 2000),
      textScale: 2,
    );
    expect(tester.takeException(), isNull);
    expect(find.text('Studio lumineux, Presqu’île'), findsOneWidget);
  });
}
