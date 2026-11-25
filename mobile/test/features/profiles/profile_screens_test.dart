import 'package:eguardimmo/core/routes/app_location.dart';
import 'package:eguardimmo/core/routes/app_routes.dart';
import 'package:eguardimmo/core/routes/route_args.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';
import '../../helpers/fixtures.dart';
import '../../helpers/harness.dart';
import '../../helpers/tenant_api.dart';

Object? _market(RecordedCall call) {
  if (call.path == '/marketplace/listings') {
    return Fixtures.listingsPage([Fixtures.listing()]);
  }
  if (call.path == '/marketplace/favorites') return Fixtures.page([]);
  return null;
}

void main() {
  testWidgets('menu : voyageur par défaut, profils réels de /me/profiles', (
    tester,
  ) async {
    await pumpApp(
      tester,
      handler: _market,
      profiles: [
        Fixtures.tenantProfile(),
        Fixtures.organizationProfile(kind: 'agency'),
        Fixtures.operatorProfile(),
      ],
    );
    expect(find.text('Profil : Voyageur'), findsOneWidget);

    await tester.tap(find.text('Profil : Voyageur'));
    await tester.pumpAndSettle();

    expect(find.text('Changer de profil'), findsOneWidget);
    expect(find.text('Locataire'), findsOneWidget);
    expect(find.text('Agence Rhône Immo'), findsOneWidget);
    expect(find.text('Console'), findsNothing);
  });

  testWidgets(
    'profil locataire : accueil réel depuis l’API, sans donnée illustrative',
    (tester) async {
      final app = await pumpApp(
        tester,
        handler: (call) => tenantApi(call) ?? _market(call),
      );
      await tester.tap(find.text('Profil : Voyageur'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Locataire'));
      await tester.pumpAndSettle();

      expect(app.router.current, const AppLocation(RouteName.tenantHome));
      expect(find.text('Mon loyer'), findsOneWidget);
      expect(find.text('Loyer de novembre 2026'), findsOneWidget);
      expect(find.textContaining('Profil : Locataire'), findsOneWidget);

      await tester.tap(find.text('Profil : Locataire'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Voyageur'));
      await tester.pumpAndSettle();
      expect(app.router.current, const AppLocation(RouteName.explore));
    },
  );

  testWidgets('échec du chargement des profils : message et reprise', (
    tester,
  ) async {
    var fail = true;
    await pumpApp(
      tester,
      handler: (call) {
        if (call.path == '/me/profiles' && fail) return networkFailure();
        return _market(call);
      },
    );
    await tester.tap(find.text('Profil : Voyageur'));
    await tester.pumpAndSettle();
    expect(
      find.textContaining('Vos autres profils n’ont pas pu être chargés'),
      findsOneWidget,
    );

    fail = false;
    await tester.tap(find.text('Réessayer'));
    await tester.pumpAndSettle();
    expect(find.text('Locataire'), findsOneWidget);
  });

  testWidgets('onglet Messages : voyageur, seul le support est proposé', (
    tester,
  ) async {
    await pumpApp(tester, handler: _market, location: RouteName.messages);
    expect(find.text('Support eGuardImmo'), findsOneWidget);
    expect(find.text('Aucune conversation'), findsOneWidget);
    expect(find.text('Bientôt disponible'), findsNothing);
  });

  group('Liens profonds', () {
    testWidgets('lien inconnu ou mal formé : retour à Explorer', (
      tester,
    ) async {
      for (final location in [
        '/admin',
        '/annonces/court',
        '/profil/console',
        '/connexion/../x',
      ]) {
        final app = await pumpApp(tester, handler: _market, location: location);
        expect(
          app.router.current,
          const AppLocation(RouteName.explore),
          reason: location,
        );
      }
    });

    testWidgets('lien valide vers une annonce : ouvert', (tester) async {
      final app = await pumpApp(
        tester,
        location: '/annonces/k3m7q9x2v8nb',
        handler: (call) => call.path.startsWith('/marketplace/listings/')
            ? {'data': Fixtures.listingDetail()}
            : _market(call),
      );
      expect(
        app.router.current,
        const AppLocation(RouteName.listing, ListingArgs('k3m7q9x2v8nb')),
      );
      expect(find.text('Studio lumineux, Presqu’île'), findsOneWidget);
    });
  });
}
