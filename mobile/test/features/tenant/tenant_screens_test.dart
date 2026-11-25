import 'package:eguardimmo/core/routes/app_location.dart';
import 'package:eguardimmo/core/routes/app_routes.dart';
import 'package:eguardimmo/core/routes/route_args.dart';
import 'package:eguardimmo/core/utils/formatters.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/api_fixtures.dart';
import '../../helpers/fakes.dart';
import '../../helpers/harness.dart';
import '../../helpers/tenant_api.dart';

final _owed = Formatters.money(65000, currency: 'EUR');

Future<Harness> _open(
  WidgetTester tester, {
  String location = RouteName.tenantHome,
  FakeHandler handler = tenantApi,
  Size size = const Size(390, 1800),
}) => pumpApp(tester, handler: handler, location: location, size: size);

Future<void> _tapText(WidgetTester tester, String text) async {
  final finder = find.text(text);
  await tester.ensureVisible(finder);
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('accueil : loyer, logement et demandes depuis l’API', (
    tester,
  ) async {
    await _open(tester);
    expect(find.text('Loyer de novembre 2026'), findsOneWidget);
    expect(find.text('En retard'), findsOneWidget);
    expect(find.text(_owed), findsWidgets);
    expect(find.text('BL-2026-76772'), findsOneWidget);
    expect(find.textContaining('Résidence Roy'), findsOneWidget);
    expect(find.text('1 demande en cours.'), findsOneWidget);
    expect(find.text('Profil : Locataire'), findsNothing);
  });

  testWidgets('accueil : « Bientôt disponible » liste ce qui manque', (
    tester,
  ) async {
    await _open(tester);
    await tester.ensureVisible(find.text('Bientôt disponible'));
    expect(find.text('Bientôt disponible'), findsOneWidget);
    expect(find.textContaining('Paiement du loyer en ligne'), findsOneWidget);
  });

  testWidgets('accueil à 320 px et texte agrandi : aucun débordement', (
    tester,
  ) async {
    await pumpApp(
      tester,
      handler: tenantApi,
      location: RouteName.tenantHome,
      size: const Size(320, 640),
      textScale: 1.6,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('échec d’une section : message visible et reprise', (
    tester,
  ) async {
    var fail = true;
    await _open(
      tester,
      handler: (call) {
        if (call.path == '/tenant/rent/installments' && fail) {
          return networkFailure();
        }
        return tenantApi(call);
      },
    );
    expect(find.textContaining('Connexion impossible'), findsOneWidget);
    expect(find.text('Loyer de novembre 2026'), findsNothing);

    fail = false;
    await tester.tap(find.text('Réessayer'));
    await tester.pumpAndSettle();
    expect(find.text('Loyer de novembre 2026'), findsOneWidget);
  });

  testWidgets('aucune échéance : état vide, jamais de « payé » inventé', (
    tester,
  ) async {
    await _open(
      tester,
      handler: (call) => call.path == '/tenant/rent/installments'
          ? apiFixture('tenant/payments_empty')
          : tenantApi(call),
    );
    expect(
      find.text('Aucune échéance appelée pour le moment.'),
      findsOneWidget,
    );
    expect(find.textContaining('Payée'), findsNothing);
  });

  testWidgets('loyers : échéances, paiements, quittances et détail', (
    tester,
  ) async {
    final app = await _open(tester);
    await _tapText(tester, 'Loyers');
    expect(app.router.current, const AppLocation(RouteName.tenantRent));
    expect(find.text('Émise'), findsWidgets);
    expect(find.textContaining('Reste dû'), findsWidgets);

    await _tapText(tester, 'Paiements');
    expect(find.text('Enregistré'), findsWidgets);
    expect(find.textContaining('Virement'), findsWidgets);

    await _tapText(tester, 'Quittances');
    expect(find.text('Quittance QT-2026-0001'), findsOneWidget);
    expect(find.textContaining('PDF'), findsOneWidget);

    await _tapText(tester, 'Échéances');
    await tester.tap(find.text('Loyer de novembre 2026').first);
    await tester.pumpAndSettle();
    expect(
      app.router.current,
      const AppLocation(
        RouteName.tenantInstallment,
        ResourceArgs(installmentId),
      ),
    );
    expect(find.text('AV-2026-0001 · 16 nov. 2026'), findsOneWidget);
    expect(find.text('Non émise'), findsOneWidget);
    expect(find.text('Loyer de novembre 2026'), findsWidgets);
  });

  testWidgets('documents partagés : liste sans téléchargement factice', (
    tester,
  ) async {
    await _open(tester, location: RouteName.tenantDocuments);
    expect(find.text('Bail BL-2026-76772'), findsOneWidget);
    expect(find.text('Avenant'), findsOneWidget);
    expect(find.textContaining('avenant-1.pdf'), findsOneWidget);
    expect(find.textContaining('pas encore disponible'), findsOneWidget);
    expect(find.text('Télécharger'), findsNothing);
  });

  group('Demandes', () {
    testWidgets('liste et détail', (tester) async {
      await _open(tester, location: RouteName.tenantRequests);
      expect(find.text('Prise électrique HS'), findsOneWidget);
      expect(find.text('Classée sans suite'), findsOneWidget);

      await tester.tap(find.text('Prise électrique HS'));
      await tester.pumpAndSettle();
      expect(find.text('Demande'), findsOneWidget);
    });

    testWidgets('détail : message envoyé, historique remplacé par le serveur', (
      tester,
    ) async {
      final app = await _open(
        tester,
        location: '/profil/locataire/demandes/$requestId',
      );
      expect(find.text('Merci de passer vite.'), findsOneWidget);
      expect(find.text('Un plombier passera cette semaine.'), findsOneWidget);

      await tester.enterText(
        find.byType(TextField).last,
        'Merci de passer vite.',
      );
      await _tapText(tester, 'Envoyer le message');
      final post = app.api.calls.last;
      expect(post.path, '/tenant/interventions/$requestId/comments');
      expect(post.body, {'text': 'Merci de passer vite.'});
    });

    testWidgets('annulation confirmée : état du serveur affiché', (
      tester,
    ) async {
      final app = await _open(
        tester,
        location: '/profil/locataire/demandes/$requestId',
      );
      await _tapText(tester, 'Annuler la demande');
      expect(find.text('Annuler cette demande ?'), findsOneWidget);
      await tester.tap(find.text('Annuler la demande').last);
      await tester.pumpAndSettle();
      expect(
        app.api.calls.last.path,
        '/tenant/interventions/$requestId/cancel',
      );
      expect(find.text('Annulée'), findsWidgets);
      expect(find.text('Annuler la demande'), findsNothing);
    });

    testWidgets('signalement : formulaire, envoi puis détail', (tester) async {
      final app = await _open(tester, location: RouteName.tenantNewRequest);
      await _tapText(tester, 'Plomberie');
      await _tapText(tester, 'À traiter rapidement');
      await tester.enterText(
        find.byType(TextFormField).at(0),
        'Fuite sous l’évier',
      );
      await tester.enterText(
        find.byType(TextFormField).at(1),
        'De l’eau coule sous l’évier de la cuisine.',
      );
      await _tapText(tester, 'Envoyer la demande');

      final post = app.api.calls.firstWhere((c) => c.method == 'POST');
      expect(post.path, '/tenant/interventions');
      expect(post.body, containsPair('lease_id', tenantLeaseId));
      expect(post.body, containsPair('reported_urgency', 'soon'));
      expect(post.headers, contains('Idempotency-Key'));
      expect(
        app.router.current,
        const AppLocation(RouteName.tenantRequest, ResourceArgs(requestId)),
      );
      expect(find.text('Demande'), findsOneWidget);
    });

    testWidgets('signalement : champs obligatoires et refus du serveur', (
      tester,
    ) async {
      await _open(
        tester,
        location: RouteName.tenantNewRequest,
        handler: (call) => call.method == 'POST'
            ? apiProblem('tenant/problem_too_many_open', status: 422)
            : tenantApi(call),
      );
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'Envoyer la demande'),
            )
            .onPressed,
        isNull,
      );
      await _tapText(tester, 'Plomberie');
      await _tapText(tester, 'Envoyer la demande');
      expect(find.text('Titre obligatoire'), findsOneWidget);
      expect(find.text('Description obligatoire'), findsOneWidget);

      await tester.enterText(find.byType(TextFormField).at(0), 'Fuite');
      await tester.enterText(find.byType(TextFormField).at(1), 'Eau');
      await _tapText(tester, 'Envoyer la demande');
      expect(
        find.text('Trop de demandes ouvertes sur ce bail.'),
        findsOneWidget,
      );
    });
  });
}
