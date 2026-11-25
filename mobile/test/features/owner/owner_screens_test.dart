import 'package:eguardimmo/features/owner/owner_paths.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/api_fixtures.dart';
import '../../helpers/fakes.dart';
import '../../helpers/fixtures.dart';
import '../../helpers/harness.dart';
import '../../helpers/owner_api.dart';

Future<Harness> _open(
  WidgetTester tester, {
  String location = OwnerPaths.home,
  FakeHandler handler = ownerApi,
  Size size = const Size(390, 3200),
  double textScale = 1,
  List<Map<String, Object?>>? profiles,
}) => pumpApp(
  tester,
  handler: handler,
  location: location,
  size: size,
  textScale: textScale,
  profiles: profiles ?? [Fixtures.ownerProfile()],
);

Future<void> _tapText(WidgetTester tester, String text) async {
  final finder = find.text(text);
  await tester.ensureVisible(finder);
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

String _flat(String text) => text.replaceAll(RegExp(r'\s'), ' ');

void main() {
  testWidgets('accueil : mois, reversements, compte rendu et biens', (
    tester,
  ) async {
    await _open(tester);
    expect(find.text('Novembre 2026'), findsOneWidget);
    expect(find.textContaining('jusqu’à 11 jours de retard'), findsOneWidget);
    expect(find.textContaining('2 devis attendent votre décision'), findsOne);
    expect(find.text('RV-2026-0006', skipOffstage: false), findsNothing);
    expect(find.text('CRG-2026-0010'), findsOneWidget);
    expect(find.text('Non lu'), findsOneWidget);
    expect(find.text('Résidence Les Filaos - B2'), findsOneWidget);
    expect(find.text('Loyer en retard'), findsOneWidget);
    expect(find.text('Vacant'), findsOneWidget);
    expect(find.text('Locataire : Pauline Martin'), findsOneWidget);
    expect(find.textContaining('jour de reversement'), findsOneWidget);
  });

  testWidgets('accueil : montants XOF sans décimales', (tester) async {
    await _open(tester);
    final texts = find
        .byType(Text)
        .evaluate()
        .map((e) => _flat((e.widget as Text).data ?? ''))
        .toList();
    expect(
      texts.any((t) => t.contains('1 200 000') && t.contains('F')),
      isTrue,
    );
    expect(texts.any((t) => t.contains(',00')), isFalse);
  });

  testWidgets('accueil : « Bientôt disponible » liste ce qui manque', (
    tester,
  ) async {
    await _open(tester);
    await tester.ensureVisible(find.text('Bientôt disponible'));
    expect(find.textContaining('comptes rendus de gestion (PDF)'), findsOne);
    expect(find.textContaining('devis d’intervention'), findsOneWidget);
  });

  testWidgets(
    'plusieurs agences : sélecteur, la sélection change les requêtes',
    (tester) async {
      final app = await _open(tester);
      expect(find.text('Agence du Lac · Famille Dossou'), findsOneWidget);
      expect(find.text('Cabinet Horizon · SCI Les Palmiers'), findsOneWidget);
      expect(find.textContaining('Accès en lecture seule'), findsNothing);

      await tester.tap(find.text('Cabinet Horizon · SCI Les Palmiers'));
      await tester.pumpAndSettle();
      final homeCalls = app.api.calls.where((c) => c.path == '/owner/home');
      expect(homeCalls.last.query, {'agency': otherAgencyId});
      expect(find.textContaining('Accès en lecture seule'), findsOneWidget);
      expect(find.textContaining('jusqu’au 31 déc'), findsOneWidget);
    },
  );

  testWidgets('une seule agence : aucun sélecteur', (tester) async {
    final one = apiObject('owner/agencies');
    (one['data']! as List<Object?>).removeLast();
    await _open(
      tester,
      handler: (call) => call.path == '/owner/agencies' ? one : ownerApi(call),
    );
    expect(find.text('Agence'), findsNothing);
    expect(find.text('Novembre 2026'), findsOneWidget);
  });

  testWidgets('aucun accès : message dédié, aucune donnée', (tester) async {
    await _open(
      tester,
      handler: (call) => call.path == '/owner/agencies'
          ? {'data': <Object?>[]}
          : ownerApi(call),
    );
    expect(find.text('Aucun accès propriétaire'), findsOneWidget);
    expect(find.text('Novembre 2026'), findsNothing);
  });

  testWidgets('accès refusé par le serveur : message visible et reprise', (
    tester,
  ) async {
    var deny = true;
    await _open(
      tester,
      handler: (call) => call.path == '/owner/agencies' && deny
          ? problem(403, 'forbidden', 'Espace non autorisé.')
          : ownerApi(call),
    );
    expect(find.text('Espace non autorisé.'), findsOneWidget);
    deny = false;
    await tester.tap(find.text('Réessayer'));
    await tester.pumpAndSettle();
    expect(find.text('Novembre 2026'), findsOneWidget);
  });

  testWidgets('échec de l’accueil : message sur chaque section, reprise', (
    tester,
  ) async {
    var fail = true;
    await _open(
      tester,
      handler: (call) => call.path == '/owner/home' && fail
          ? networkFailure()
          : ownerApi(call),
    );
    expect(find.textContaining('Connexion impossible'), findsWidgets);
    expect(find.text('Novembre 2026'), findsNothing);
    fail = false;
    await tester.tap(find.text('Réessayer').first);
    await tester.pumpAndSettle();
    expect(find.text('Novembre 2026'), findsOneWidget);
  });

  testWidgets('profil propriétaire en nom propre : Bientôt disponible', (
    tester,
  ) async {
    final profile = Fixtures.organizationProfile(kind: 'individual');
    await _open(tester, profiles: [profile]);
    await tester.tap(find.text('Profil : Voyageur'));
    await tester.pumpAndSettle();
    await tester.tap(find.text(profile['label']! as String));
    await tester.pumpAndSettle();
    expect(find.text('Bientôt disponible'), findsOneWidget);
    expect(find.text('Novembre 2026'), findsNothing);
  });

  testWidgets('accueil à 320 px et texte agrandi : aucun débordement', (
    tester,
  ) async {
    await _open(tester, size: const Size(320, 640), textScale: 1.6);
    expect(tester.takeException(), isNull);
  });

  testWidgets('reversements : statuts et prochain reversement', (tester) async {
    final app = await _open(tester);
    await _tapText(tester, 'Virements reçus et prochain reversement');
    expect(app.router.state.uri.path, OwnerPaths.payouts);
    expect(find.text('Prochain reversement'), findsOneWidget);
    expect(find.text('Programmé'), findsOneWidget);
    expect(find.text('Versé'), findsOneWidget);
    expect(find.text('Retourné par la banque'), findsOneWidget);
    expect(find.text('Compte se terminant par 1234'), findsNWidgets(2));
    expect(find.textContaining('rapprochez-vous de votre agence'), findsOne);
  });

  testWidgets('reversements : aucun reversement, état vide', (tester) async {
    await _open(
      tester,
      location: OwnerPaths.payouts,
      handler: (call) => call.path == '/owner/payouts'
          ? {
              'data': <Object?>[],
              'meta': {'next_cursor': null},
              'upcoming': <Object?>[],
            }
          : ownerApi(call),
    );
    expect(find.text('Aucun reversement pour le moment.'), findsOneWidget);
  });

  testWidgets('relevé : mois courant, lignes, navigation de mois', (
    tester,
  ) async {
    final app = await _open(tester, location: OwnerPaths.statement);
    expect(find.text('Loyer novembre 2026'), findsOneWidget);
    expect(find.text('Honoraires de gestion'), findsOneWidget);
    expect(find.text('Solde de clôture'), findsOneWidget);
    final next = find.widgetWithIcon(IconButton, Icons.chevron_right_rounded);
    expect(tester.widget<IconButton>(next).onPressed, isNull);

    await tester.tap(find.byTooltip('Mois précédent'));
    await tester.pumpAndSettle();
    final statementCalls = app.api.calls
        .where((c) => c.path == '/owner/statement')
        .toList();
    expect(statementCalls.last.query?['from'], '2026-10-01');
    expect(statementCalls.last.query?['to'], '2026-10-31');
    expect(find.text('Octobre 2026'), findsOneWidget);
    expect(tester.widget<IconButton>(next).onPressed, isNotNull);
  });

  testWidgets('relevé : mois sans opération', (tester) async {
    final empty = apiObject('owner/statement');
    (empty['data']! as Map<String, Object?>)['lines'] = <Object?>[];
    await _open(
      tester,
      location: OwnerPaths.statement,
      handler: (call) =>
          call.path == '/owner/statement' ? empty : ownerApi(call),
    );
    expect(find.text('Aucune opération sur ce mois.'), findsOneWidget);
    expect(find.text('Solde d’ouverture'), findsOneWidget);
  });

  testWidgets('relevé : échec serveur affiché, reprise', (tester) async {
    var fail = true;
    await _open(
      tester,
      location: OwnerPaths.statement,
      handler: (call) => call.path == '/owner/statement' && fail
          ? problem(422, 'statement_range_too_long', 'Période trop longue.')
          : ownerApi(call),
    );
    expect(find.text('Période trop longue.'), findsOneWidget);
    fail = false;
    await tester.tap(find.text('Réessayer'));
    await tester.pumpAndSettle();
    expect(find.text('Honoraires de gestion'), findsOneWidget);
  });

  testWidgets('biens : lots sous mandat', (tester) async {
    await _open(tester, location: OwnerPaths.properties);
    expect(find.text('Résidence Les Filaos · A1'), findsOneWidget);
    expect(find.textContaining('14 avenue de la Marina'), findsWidgets);
    expect(find.textContaining('Sous mandat du'), findsOneWidget);
  });

  testWidgets('documents : libellés et pas de téléchargement factice', (
    tester,
  ) async {
    await _open(tester, location: OwnerPaths.documents);
    expect(find.text('Mandat signé'), findsOneWidget);
    expect(find.textContaining('mandat-gestion-2026.pdf'), findsOneWidget);
    expect(find.textContaining('déposé par Agence du Lac'), findsOneWidget);
    expect(find.textContaining('n’est pas encore disponible'), findsOneWidget);
    expect(find.text('Télécharger'), findsNothing);
  });

  testWidgets('déconnecté : invitation à se connecter, aucune requête', (
    tester,
  ) async {
    final app = await pumpApp(
      tester,
      handler: ownerApi,
      location: OwnerPaths.home,
      signedIn: false,
    );
    expect(find.text('Connexion requise'), findsOneWidget);
    expect(app.api.calls.where((c) => c.path.startsWith('/owner')), isEmpty);
  });
}
