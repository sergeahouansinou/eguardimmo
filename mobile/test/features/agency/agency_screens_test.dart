import 'package:eguardimmo/features/agency/agency_paths.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/agency_api.dart';
import '../../helpers/fakes.dart';
import '../../helpers/fixtures.dart';
import '../../helpers/harness.dart';

Future<Harness> _open(
  WidgetTester tester, {
  String path = AgencyPaths.home,
  FakeHandler handler = agencyApi,
  Size size = const Size(390, 3200),
  double textScale = 1,
  List<Map<String, Object?>>? profiles,
  bool selectAgency = true,
}) async {
  final app = await pumpApp(
    tester,
    handler: handler,
    size: size,
    textScale: textScale,
    profiles: profiles ?? [Fixtures.organizationProfile(kind: 'agency')],
  );
  if (selectAgency) {
    await tester.tap(find.text('Profil : Voyageur'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Agence Rhône Immo'));
    await tester.pumpAndSettle();
  }
  if (path != AgencyPaths.home) {
    app.router.go(path);
    await tester.pumpAndSettle();
  }
  return app;
}

Future<void> _tapText(WidgetTester tester, String text) async {
  final finder = find.text(text);
  await tester.ensureVisible(finder);
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('accueil : indicateurs, reversements et alertes de l’API', (
    tester,
  ) async {
    final app = await _open(tester);
    expect(app.router.state.uri.path, AgencyPaths.home);
    expect(find.text('Novembre 2026'), findsOneWidget);
    expect(find.text('Période clôturée'), findsOneWidget);
    expect(find.text('97,1 %'), findsOneWidget);
    expect(find.text('Awa Diallo'), findsOneWidget);
    expect(find.text('Propriétaire sans nom'), findsOneWidget);
    expect(find.text('Mandats à renouveler'), findsOneWidget);
    expect(find.textContaining('MG-2026-0001'), findsOneWidget);
    expect(find.text('Certificats à renouveler'), findsOneWidget);
    expect(
      app.api.calls.map((c) => c.path).where((p) => p.contains('/org/')),
      everyElement(startsWith('/org/$agencyOrgId/')),
    );
  });

  testWidgets('accueil : « Bientôt disponible » liste les actions absentes', (
    tester,
  ) async {
    await _open(tester);
    expect(find.text('Bientôt disponible'), findsOneWidget);
    expect(
      find.textContaining('Visites, engagement d’urgence'),
      findsOneWidget,
    );
    expect(find.textContaining('Qualification, refus'), findsNothing);
  });

  testWidgets('accueil à 320 px et texte agrandi : aucun débordement', (
    tester,
  ) async {
    await _open(tester, size: const Size(320, 640), textScale: 1.6);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    '403 sur une carte : message du serveur, autres cartes intactes',
    (tester) async {
      await _open(
        tester,
        handler: (call) => call.path.endsWith('/agency-payouts')
            ? problem(403, 'forbidden', 'Rôle insuffisant pour cette carte.')
            : agencyApi(call),
      );
      expect(find.text('Rôle insuffisant pour cette carte.'), findsOneWidget);
      expect(find.text('97,1 %'), findsOneWidget);
      expect(find.text('Awa Diallo'), findsNothing);
    },
  );

  testWidgets('échec réseau : message et reprise sur la carte', (tester) async {
    var fail = true;
    await _open(
      tester,
      handler: (call) => call.path.endsWith('/agency-kpis') && fail
          ? networkFailure()
          : agencyApi(call),
    );
    expect(find.textContaining('Connexion impossible'), findsOneWidget);
    expect(find.text('97,1 %'), findsNothing);
    fail = false;
    await tester.tap(find.text('Réessayer'));
    await tester.pumpAndSettle();
    expect(find.text('97,1 %'), findsOneWidget);
  });

  testWidgets('aucune alerte : « Rien à signaler »', (tester) async {
    await _open(
      tester,
      handler: (call) => call.path.endsWith('/agency-alerts')
          ? {
              'data': {
                'mandates_to_renew': {'count': 0, 'next': <Object?>[]},
                'certificates_to_renew': 0,
                'reports_due': {
                  'period': {'start': '2026-10-01', 'end': '2026-10-31'},
                  'count': 0,
                  'mandant_ids': <Object?>[],
                },
              },
            }
          : agencyApi(call),
    );
    expect(find.text('Rien à signaler pour le moment.'), findsOneWidget);
  });

  testWidgets('sans profil agence actif : choix de l’agence, aucune requête', (
    tester,
  ) async {
    final app = await _open(
      tester,
      path: AgencyPaths.unpaid,
      selectAgency: false,
    );
    expect(find.text('Choisissez votre agence'), findsOneWidget);
    expect(app.api.calls.where((c) => c.path.startsWith('/org/')), isEmpty);
  });

  testWidgets('impayés : triés par retard, total et dossier', (tester) async {
    await _open(tester, path: AgencyPaths.unpaid);
    expect(find.text('72 jours de retard'), findsOneWidget);
    expect(find.text('11 jours de retard'), findsOneWidget);
    expect(find.text('Célina Barre'), findsWidgets);
    expect(find.text('Créances en retard'), findsOneWidget);
    expect(find.textContaining('Reste dû'), findsWidgets);
    final late = tester.getTopLeft(find.text('72 jours de retard')).dy;
    final recent = tester.getTopLeft(find.text('11 jours de retard')).dy;
    expect(late, lessThan(recent));
  });

  testWidgets('impayés : aucun impayé, état vide', (tester) async {
    await _open(
      tester,
      path: AgencyPaths.unpaid,
      handler: (call) => call.path.endsWith('/recovery/unpaid')
          ? {
              'data': <Object?>[],
              'meta': {'next_after': null},
            }
          : agencyApi(call),
    );
    expect(
      find.text('Aucun impayé : toutes les échéances sont à jour.'),
      findsOneWidget,
    );
  });

  testWidgets('impayés : 403 affiché avec reprise', (tester) async {
    await _open(
      tester,
      path: AgencyPaths.unpaid,
      handler: (call) => call.path.endsWith('/recovery/unpaid')
          ? problem(403, 'forbidden', 'Recouvrement non inclus dans l’offre.')
          : agencyApi(call),
    );
    expect(find.text('Recouvrement non inclus dans l’offre.'), findsOneWidget);
    expect(find.text('Réessayer'), findsOneWidget);
  });

  testWidgets('interventions : liste, filtres envoyés au serveur', (
    tester,
  ) async {
    final app = await _open(tester, path: AgencyPaths.interventions);
    expect(find.text('Signalée'), findsOneWidget);
    expect(find.text('Facturée'), findsOneWidget);
    expect(find.text('Ramonage du Port SARL'), findsNothing);
    expect(find.textContaining('Ramonage du Port SARL'), findsOneWidget);
    expect(find.textContaining('Lecture seule'), findsNothing);

    await _tapText(tester, 'Devis à approuver');
    final calls = app.api.calls
        .where((c) => c.path.endsWith('/interventions'))
        .toList();
    expect(calls.last.query?['status'], 'awaiting_approval');
  });

  testWidgets('interventions : filtre sans résultat, état vide', (
    tester,
  ) async {
    await _open(
      tester,
      path: AgencyPaths.interventions,
      handler: (call) =>
          call.path.endsWith('/interventions') &&
              call.query?['status'] == 'in_progress'
          ? {
              'data': <Object?>[],
              'meta': {'next_cursor': null},
            }
          : agencyApi(call),
    );
    await _tapText(tester, 'En cours');
    expect(
      find.text('Aucune intervention ne correspond à ce filtre.'),
      findsOneWidget,
    );
  });

  testWidgets('portefeuille : biens puis baux filtrés par phase', (
    tester,
  ) async {
    final app = await _open(tester, path: AgencyPaths.portfolio);
    expect(find.text('Résidence Roy'), findsOneWidget);
    expect(find.text('Villa des Pins'), findsOneWidget);
    expect(find.textContaining('6 lots actifs'), findsOneWidget);
    expect(find.textContaining('1 lot actif'), findsOneWidget);

    await _tapText(tester, 'Baux');
    expect(find.text('Édouard Gillet, Léa Gillet'), findsOneWidget);
    expect(find.text('Aucun locataire renseigné'), findsOneWidget);
    final lease = app.api.calls.where((c) => c.path.endsWith('/leases')).last;
    expect(lease.query?['phase'], 'running');

    await _tapText(tester, 'Terminés');
    final ended = app.api.calls.where((c) => c.path.endsWith('/leases')).last;
    expect(ended.query?['phase'], 'ended');
  });

  testWidgets('navigation depuis l’accueil vers les trois parcours', (
    tester,
  ) async {
    final app = await _open(tester);
    await _tapText(tester, 'Échéances et factures en retard');
    expect(app.router.state.uri.path, AgencyPaths.unpaid);
    app.router.pop();
    await tester.pumpAndSettle();
    await _tapText(tester, 'À qualifier, devis à approuver, en cours');
    expect(app.router.state.uri.path, AgencyPaths.interventions);
  });

  testWidgets('déconnecté : invitation à se connecter, aucune requête', (
    tester,
  ) async {
    final app = await pumpApp(
      tester,
      handler: agencyApi,
      location: AgencyPaths.home,
      signedIn: false,
    );
    expect(find.text('Connexion requise'), findsOneWidget);
    expect(app.api.calls.where((c) => c.path.startsWith('/org/')), isEmpty);
  });
}
