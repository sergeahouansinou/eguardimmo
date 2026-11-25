import 'package:eguardimmo/core/routes/app_routes.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';
import '../../helpers/fixtures.dart';
import '../../helpers/harness.dart';

FakeHandler _handler({
  String kind = 'short_stay',
  Object? Function(RecordedCall)? visit,
}) {
  return (call) {
    if (call.path == '/marketplace/listings/k3m7q9x2v8nb') {
      return {
        'data': {...Fixtures.listingDetail(), 'kind': kind},
      };
    }
    if (call.path == '/marketplace/favorites') return Fixtures.page([]);
    if (call.path.endsWith('/visit-requests')) {
      return visit?.call(call) ?? Fixtures.visitRequest();
    }
    if (call.path.endsWith('/availability')) {
      return Fixtures.availability([('2027-03-10', '2027-03-14')]);
    }
    if (call.path.endsWith('/quote')) return Fixtures.quote();
    return null;
  };
}

void main() {
  const location = '/annonces/k3m7q9x2v8nb';

  testWidgets('fiche : titre, agence, onglet Conditions', (tester) async {
    await pumpApp(tester, handler: _handler(), location: location);

    expect(find.text('Studio lumineux, Presqu’île'), findsOneWidget);
    expect(find.text('Visite'), findsOneWidget);
    expect(find.text('Réserver'), findsOneWidget);
    expect(find.textContaining('Studio de 28'), findsOneWidget);

    await tester.tap(find.text('Conditions'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Studio de 28'), findsNothing);
  });

  testWidgets('fiche : équipements du référentiel, hôte, conditions', (
    tester,
  ) async {
    await pumpApp(tester, handler: _handler(), location: location);
    expect(find.text('Wi-Fi'), findsOneWidget);
    expect(find.text('Cuisine équipée'), findsOneWidget);
    expect(find.text('Agence Rhône Immo'), findsOneWidget);

    await tester.tap(find.text('Conditions'));
    await tester.pumpAndSettle();
    expect(find.text('Séjour minimum : 2 nuits'), findsOneWidget);
    expect(find.textContaining('Dépôt de garantie : 300'), findsOneWidget);
    expect(find.textContaining('Annulation modérée'), findsOneWidget);
  });

  testWidgets('ville et hôte absents : fiche affichée sans carte d’hôte', (
    tester,
  ) async {
    await pumpApp(
      tester,
      location: location,
      handler: (call) {
        if (call.path == '/marketplace/listings/k3m7q9x2v8nb') {
          return {
            'data': {
              ...Fixtures.listingDetail(),
              'city': null,
              'neighbourhood': null,
              'host': {'name': null},
              'min_nights': null,
            },
          };
        }
        return call.path == '/marketplace/favorites' ? Fixtures.page([]) : null;
      },
    );
    expect(tester.takeException(), isNull);
    expect(find.text('Studio lumineux, Presqu’île'), findsOneWidget);
    expect(find.text('Proposé par'), findsNothing);
  });

  testWidgets(
    'réserver : les disponibilités sont lues et les périodes occupées affichées',
    (tester) async {
      final app = await pumpApp(
        tester,
        handler: _handler(),
        location: location,
      );
      await tester.tap(find.text('Réserver'));
      await tester.pumpAndSettle();

      final availability = app.api.calls.singleWhere(
        (c) => c.path.endsWith('/availability'),
      );
      expect(availability.query!.keys, containsAll(['from', 'to']));
      expect(find.textContaining('Déjà réservé : 10 au'), findsOneWidget);
      expect(find.text('Choisir les dates'), findsOneWidget);
    },
  );

  testWidgets('annonce de location longue : pas de bouton Réserver', (
    tester,
  ) async {
    await pumpApp(
      tester,
      handler: _handler(kind: 'long_term'),
      location: location,
    );
    expect(find.text('Visite'), findsOneWidget);
    expect(find.text('Réserver'), findsNothing);
  });

  testWidgets('demande de visite : validation puis envoi', (tester) async {
    final app = await pumpApp(tester, handler: _handler(), location: location);
    await tester.tap(find.text('Visite'));
    await tester.pumpAndSettle();
    expect(find.text('Demander une visite'), findsOneWidget);

    await tester.tap(find.text('Envoyer la demande'));
    await tester.pumpAndSettle();
    expect(find.text('Indiquez un créneau'), findsOneWidget);
    expect(app.api.calls.where((c) => c.method == 'POST'), isEmpty);

    await tester.enterText(find.byType(TextFormField).first, 'samedi 10 h');
    await tester.tap(find.text('Envoyer la demande'));
    await tester.pumpAndSettle();

    final post = app.api.calls.singleWhere((c) => c.method == 'POST');
    expect(post.path, '/marketplace/listings/k3m7q9x2v8nb/visit-requests');
    expect((post.body! as Map)['requested_slot'], 'samedi 10 h');
    expect(find.text('Demande envoyée'), findsOneWidget);
  });

  testWidgets('déconnecté : Visite renvoie à la connexion', (tester) async {
    final app = await pumpApp(
      tester,
      handler: _handler(),
      location: location,
      signedIn: false,
    );
    await tester.tap(find.text('Visite'));
    await tester.pumpAndSettle();
    expect(app.router.state.uri.path, AppRoutes.login);
    expect(app.api.calls.where((c) => c.method == 'POST'), isEmpty);
  });

  testWidgets('annonce introuvable : message du serveur et reprise', (
    tester,
  ) async {
    await pumpApp(
      tester,
      handler: (call) => call.path.startsWith('/marketplace/listings/')
          ? problem(404, 'listing_not_found', 'Annonce introuvable.')
          : null,
      location: location,
    );
    expect(find.text('Annonce introuvable.'), findsOneWidget);
    expect(find.text('Réessayer'), findsOneWidget);
  });

  testWidgets('pas de débordement à 320 px, texte à 200 %', (tester) async {
    await pumpApp(
      tester,
      handler: _handler(),
      location: location,
      size: const Size(320, 640),
      textScale: 2,
    );
    expect(tester.takeException(), isNull);
  });
}
