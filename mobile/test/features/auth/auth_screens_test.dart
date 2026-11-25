import 'package:eguardimmo/core/routes/app_routes.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';
import '../../helpers/fixtures.dart';
import '../../helpers/harness.dart';

Object? _market(RecordedCall call) {
  if (call.path == '/marketplace/listings') {
    return Fixtures.listingsPage([Fixtures.listing()]);
  }
  if (call.path == '/marketplace/favorites') return Fixtures.page([]);
  return null;
}

Future<void> _fill(WidgetTester tester, int index, String text) async {
  await tester.enterText(find.byType(TextFormField).at(index), text);
}

void main() {
  group('Connexion', () {
    testWidgets('chemin nominal : jeton stocké, retour à l’écran appelant', (
      tester,
    ) async {
      final app = await pumpApp(
        tester,
        signedIn: false,
        handler: (call) {
          if (call.path == '/auth/token') return Fixtures.loginToken();
          return _market(call);
        },
      );
      await tester.tap(find.text('Se connecter'));
      await tester.pumpAndSettle();
      expect(app.router.state.uri.path, AppRoutes.login);

      await _fill(tester, 0, 'jeanne@exemple.fr');
      await _fill(tester, 1, 'motdepasse-solide');
      app.api.handler = appHandler((call) {
        if (call.path == '/auth/token') return Fixtures.loginToken();
        return _market(call);
      });
      await tester.tap(
        find.widgetWithText(ElevatedButton, 'Se connecter').evaluate().isEmpty
            ? find.text('Se connecter').last
            : find.widgetWithText(ElevatedButton, 'Se connecter'),
      );
      await tester.pumpAndSettle();

      final login = app.api.calls.singleWhere((c) => c.path == '/auth/token');
      expect((login.body! as Map)['email'], 'jeanne@exemple.fr');
      expect((login.body! as Map)['device_name'], isNotEmpty);
      expect(login.authenticated, isFalse);
      expect(app.tokens.token, Fixtures.token);
      expect(app.router.state.uri.path, AppRoutes.explore);
      expect(find.textContaining('Profil :'), findsOneWidget);
    });

    testWidgets('champs vides : validation, aucun appel', (tester) async {
      final app = await pumpApp(
        tester,
        signedIn: false,
        handler: _market,
        location: AppRoutes.login,
      );
      await tester.tap(find.text('Se connecter').last);
      await tester.pumpAndSettle();
      expect(app.api.calls.where((c) => c.path == '/auth/token'), isEmpty);
    });

    testWidgets('double authentification : défi puis code', (tester) async {
      final app = await pumpApp(
        tester,
        signedIn: false,
        location: AppRoutes.login,
        handler: (call) {
          if (call.path == '/auth/token') return Fixtures.loginChallenge();
          if (call.path == '/auth/token/two-factor') {
            return Fixtures.loginToken();
          }
          return _market(call);
        },
      );
      await _fill(tester, 0, 'jeanne@exemple.fr');
      await _fill(tester, 1, 'motdepasse-solide');
      await tester.tap(find.text('Se connecter').last);
      await tester.pumpAndSettle();
      expect(find.text('Vérification en deux étapes'), findsOneWidget);
      expect(app.tokens.token, isNull);

      await _fill(tester, 0, '123456');
      app.api.handler = appHandler((call) {
        if (call.path == '/auth/token/two-factor') return Fixtures.loginToken();
        return _market(call);
      });
      await tester.tap(find.text('Valider'));
      await tester.pumpAndSettle();

      final two = app.api.calls.singleWhere(
        (c) => c.path == '/auth/token/two-factor',
      );
      expect((two.body! as Map)['challenge'], 'c' * 64);
      expect((two.body! as Map)['code'], '123456');
      expect(app.tokens.token, Fixtures.token);
    });

    testWidgets('identifiants refusés : message du serveur, pas de jeton', (
      tester,
    ) async {
      final app = await pumpApp(
        tester,
        signedIn: false,
        location: AppRoutes.login,
        handler: (call) => call.path == '/auth/token'
            ? problem(
                422,
                'invalid_credentials',
                'Ces identifiants ne correspondent à aucun compte.',
              )
            : _market(call),
      );
      await _fill(tester, 0, 'jeanne@exemple.fr');
      await _fill(tester, 1, 'mauvais');
      await tester.tap(find.text('Se connecter').last);
      await tester.pumpAndSettle();

      expect(
        find.text('Ces identifiants ne correspondent à aucun compte.'),
        findsOneWidget,
      );
      expect(app.tokens.token, isNull);
    });

    testWidgets('pas de débordement à 320 px, texte à 200 %', (tester) async {
      await pumpApp(
        tester,
        signedIn: false,
        location: AppRoutes.login,
        handler: _market,
        size: const Size(320, 640),
        textScale: 2,
      );
      expect(tester.takeException(), isNull);
    });
  });

  group('Compte', () {
    testWidgets('affiche l’utilisateur et l’état de vérification', (
      tester,
    ) async {
      await pumpApp(tester, handler: _market, location: AppRoutes.account);
      expect(find.text('Jeanne Martin'), findsOneWidget);
      expect(find.text('jeanne@exemple.fr'), findsOneWidget);
      expect(find.text('E-mail vérifié'), findsOneWidget);
    });

    testWidgets('e-mail non vérifié : avertissement', (tester) async {
      await pumpApp(
        tester,
        location: AppRoutes.account,
        handler: (call) =>
            call.path == '/me' ? Fixtures.me(verifiedAt: null) : _market(call),
      );
      expect(find.text('E-mail à vérifier'), findsOneWidget);
      expect(
        find.textContaining('Confirmez votre adresse e-mail'),
        findsOneWidget,
      );
    });

    testWidgets('déconnexion : révocation serveur puis jeton effacé', (
      tester,
    ) async {
      final app = await pumpApp(
        tester,
        handler: _market,
        location: AppRoutes.account,
      );
      await tester.ensureVisible(find.text('Se déconnecter'));
      await tester.tap(find.text('Se déconnecter'));
      await tester.pumpAndSettle();

      expect(
        app.api.calls.where(
          (c) => c.method == 'DELETE' && c.path == '/auth/token',
        ),
        hasLength(1),
      );
      expect(app.tokens.token, isNull);
      expect(find.text('Connexion requise'), findsOneWidget);
    });

    testWidgets(
      'révocation non confirmée : jeton local effacé et avertissement',
      (tester) async {
        final app = await pumpApp(
          tester,
          location: AppRoutes.account,
          handler: (call) =>
              call.method == 'DELETE' ? networkFailure() : _market(call),
        );
        await tester.ensureVisible(find.text('Se déconnecter'));
        await tester.tap(find.text('Se déconnecter'));
        await tester.pumpAndSettle();

        expect(app.tokens.token, isNull);
        expect(
          find.textContaining(
            'révocation de la session n’a pas pu être confirmée',
          ),
          findsOneWidget,
        );
      },
    );

    testWidgets(
      'jeton expiré (401) : retour à l’état déconnecté, jeton effacé',
      (tester) async {
        final app = await pumpApp(
          tester,
          location: AppRoutes.stays,
          handler: (call) => call.path == '/marketplace/bookings'
              ? problem(401, 'unauthenticated', 'Non authentifié.')
              : _market(call),
        );
        expect(app.tokens.token, isNull);
        expect(find.text('Connexion requise'), findsOneWidget);
      },
    );
  });
}
