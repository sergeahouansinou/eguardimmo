import 'package:eguardimmo/core/routes/app_location.dart';
import 'package:eguardimmo/core/routes/app_routes.dart';
import 'package:eguardimmo/core/routes/route_args.dart';
import 'package:eguardimmo/core/routes/router_manager.dart';
import 'package:eguardimmo/core/widgets/app_shell.dart';
import 'package:eguardimmo/features/sebook/screens/explore_screen.dart';
import 'package:eguardimmo/features/tenant/screens/tenant_home_screen.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fakes.dart';
import '../helpers/fixtures.dart';
import '../helpers/harness.dart';

const _id = '01a1e955-004b-709d-9353-b6f2e30e1028';
const _ref = 'k3m7q9x2v8nb';
const _explore = AppLocation(RouteName.explore);
const _listing = AppLocation(RouteName.listing, ListingArgs(_ref));

Object? _market(RecordedCall call) {
  if (call.path == '/marketplace/listings/$_ref') {
    return {'data': Fixtures.listingDetail()};
  }
  if (call.path.startsWith('/marketplace/')) return Fixtures.page([]);
  return null;
}

int _calls(Harness app, String path) =>
    app.api.calls.where((call) => call.path == path).length;

void main() {
  group('hiérarchie', () {
    test('une destination est précédée de ses parents', () {
      expect(
        RouterManager.stackFor(
          const AppLocation(RouteName.tenantRequest, ResourceArgs(_id)),
        ),
        const [
          AppLocation(RouteName.tenantHome),
          AppLocation(RouteName.tenantRequests),
          AppLocation(RouteName.tenantRequest, ResourceArgs(_id)),
        ],
      );
      expect(RouterManager.stackFor(_listing), const [_explore, _listing]);
      expect(RouterManager.stackFor(_explore), const [_explore]);
    });

    testWidgets(
      'lien profond vers un écran de profil : retour parent par parent',
      (tester) async {
        final app = await pumpApp(
          tester,
          handler: (call) => call.path.startsWith('/tenant/')
              ? problem(404, 'not_found', 'Introuvable.')
              : null,
          location: '/profil/locataire/demandes/$_id',
        );
        expect(
          app.router.current,
          const AppLocation(RouteName.tenantRequest, ResourceArgs(_id)),
        );

        app.router.pop();
        await tester.pumpAndSettle();
        expect(app.router.current, const AppLocation(RouteName.tenantRequests));

        app.router.pop();
        await tester.pumpAndSettle();
        expect(app.router.stack, const [AppLocation(RouteName.tenantHome)]);
      },
    );
  });

  group('refus', () {
    for (final (title, name, arguments) in [
      ('argument absent', RouteName.tenantRequest, null),
      (
        'identifiant qui détourne le chemin',
        RouteName.conversation,
        const ResourceArgs('../x'),
      ),
      ('argument d’un autre type', RouteName.listing, const ResourceArgs(_id)),
      (
        'référence mal formée',
        RouteName.listing,
        const ListingArgs('../etc/passwd'),
      ),
    ]) {
      testWidgets('$title : aucun appel, retour à l’accueil', (tester) async {
        final app = await pumpApp(tester, handler: _market);
        final before = app.api.calls.length;
        app.router.navigator!.pushNamed(name, arguments: arguments).ignore();
        await tester.pumpAndSettle();
        expect(app.router.stack, const [_explore]);
        expect(
          app.api.calls
              .skip(before)
              .where((call) => call.path != '/marketplace/listings'),
          isEmpty,
        );
      });
    }
  });

  group('liens reçus application ouverte', () {
    testWidgets('lien complet : filtré puis ouvert sur ses parents', (
      tester,
    ) async {
      final app = await pumpApp(tester, handler: _market);
      await receiveLink(tester, 'https://eguardimmo.fr/annonces/$_ref');
      expect(app.router.stack, const [_explore, _listing]);
    });

    testWidgets('lien vers l’onglet affiché : une seule coquille', (
      tester,
    ) async {
      final app = await pumpApp(
        tester,
        handler: _market,
        location: RouteName.stays,
      );
      await receiveLink(tester, RouteName.stays);
      expect(app.router.stack, const [AppLocation(RouteName.stays)]);
      expect(find.byType(AppShell, skipOffstage: false), findsOneWidget);
    });

    testWidgets('lien vers un détail : le retour mène à son parent', (
      tester,
    ) async {
      final app = await pumpApp(
        tester,
        handler: (call) => call.path.startsWith('/tenant/')
            ? problem(404, 'not_found', 'Introuvable.')
            : _market(call),
        location: RouteName.account,
      );
      await receiveLink(tester, '/profil/locataire/demandes/$_id');
      app.router.pop();
      await tester.pumpAndSettle();
      expect(app.router.current, const AppLocation(RouteName.tenantRequests));
    });

    testWidgets('détail déjà ouvert : ni second écran ni second appel', (
      tester,
    ) async {
      final app = await pumpApp(
        tester,
        handler: _market,
        location: '/annonces/$_ref',
      );
      await receiveLink(tester, '/annonces/$_ref');
      expect(app.router.stack, const [_explore, _listing]);
      expect(_calls(app, '/marketplace/listings/$_ref'), 1);
    });

    testWidgets('lien inconnu reçu : retour à l’accueil', (tester) async {
      final app = await pumpApp(
        tester,
        handler: _market,
        location: '/annonces/$_ref',
      );
      await receiveLink(tester, '/admin');
      expect(app.router.stack, const [_explore]);
    });

    testWidgets('lien mal encodé reçu : retour à l’accueil', (tester) async {
      final app = await pumpApp(
        tester,
        handler: _market,
        location: '/annonces/$_ref',
      );
      // Des observateurs du framework, inscrits avant le nôtre, décodent le
      // chemin et signalent chacun l'erreur sans interrompre la distribution.
      final errors = <Object>[];
      final report = FlutterError.onError;
      FlutterError.onError = (details) => errors.add(details.exception);
      await receiveLink(tester, '/annonces/%FF');
      FlutterError.onError = report;

      expect(errors, everyElement(isFormatException));
      expect(app.router.stack, const [_explore]);
    });

    testWidgets('lien mal encodé au démarrage : accueil', (tester) async {
      final app = await pumpApp(
        tester,
        handler: _market,
        location: '/annonces/%FF',
      );
      expect(tester.takeException(), isNull);
      expect(app.router.stack, const [_explore]);
    });
  });

  group('onglets', () {
    testWidgets('un onglet non visité n’appelle rien', (tester) async {
      final app = await pumpApp(tester, handler: _market);
      expect(_calls(app, '/marketplace/bookings'), 0);

      await tester.tap(find.text('Séjours'));
      await tester.pumpAndSettle();
      expect(_calls(app, '/marketplace/bookings'), 1);
      expect(app.router.current, const AppLocation(RouteName.stays));
    });

    testWidgets('lien profond : l’onglet de fond attend le retour', (
      tester,
    ) async {
      final app = await pumpApp(
        tester,
        handler: _market,
        location: '/annonces/$_ref',
      );
      expect(_calls(app, '/marketplace/listings'), 0);

      app.router.pop();
      await tester.pumpAndSettle();
      expect(app.router.stack, const [_explore]);
      expect(_calls(app, '/marketplace/listings'), 1);
    });

    testWidgets('changer d’onglet depuis un détail garde l’état des onglets', (
      tester,
    ) async {
      final app = await pumpApp(tester, handler: _market);
      final explore = tester.state(find.byType(ExploreScreen));
      app.router.go(RouteName.listing, arguments: const ListingArgs(_ref));
      await tester.pumpAndSettle();

      app.router.go(RouteName.stays);
      await tester.pumpAndSettle();
      expect(app.router.stack, const [AppLocation(RouteName.stays)]);

      await tester.tap(find.text('Explorer'));
      await tester.pumpAndSettle();
      expect(tester.state(find.byType(ExploreScreen)), same(explore));
      expect(_calls(app, '/marketplace/listings'), 1);
    });

    testWidgets('l’accueil de profil déjà ouvert n’est pas rechargé', (
      tester,
    ) async {
      final app = await pumpApp(
        tester,
        handler: (call) => call.path.startsWith('/tenant/')
            ? problem(404, 'not_found', 'Introuvable.')
            : _market(call),
        location: RouteName.tenantHome,
      );
      final home = tester.element(find.byType(TenantHomeScreen));
      final before = app.api.calls.length;

      app.router.go(RouteName.tenantHome);
      await tester.pumpAndSettle();
      expect(tester.element(find.byType(TenantHomeScreen)), same(home));
      expect(app.api.calls.length, before);

      app.router.go(RouteName.tenantRent);
      await tester.pumpAndSettle();
      app.router.go(RouteName.tenantHome);
      await tester.pumpAndSettle();
      expect(tester.element(find.byType(TenantHomeScreen)), same(home));
      expect(app.router.stack, const [AppLocation(RouteName.tenantHome)]);
    });

    testWidgets('un espace de profil remplace la coquille, sans retour', (
      tester,
    ) async {
      final app = await pumpApp(
        tester,
        handler: (call) => call.path.startsWith('/tenant/')
            ? problem(404, 'not_found', 'Introuvable.')
            : _market(call),
      );
      app.router.go(RouteName.tenantHome);
      await tester.pumpAndSettle();
      expect(app.router.stack, const [AppLocation(RouteName.tenantHome)]);
      expect(app.router.navigator!.canPop(), isFalse);

      app.router.go(RouteName.explore);
      await tester.pumpAndSettle();
      expect(app.router.stack, const [_explore]);
    });
  });
}
