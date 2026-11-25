import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/api_fixtures.dart';
import '../../helpers/fakes.dart';
import '../../helpers/profile_harness.dart';
import 'messages_api.dart';

void main() {
  group('boîte du locataire', () {
    testWidgets('liste, non lu, fil fermé et accès au support', (tester) async {
      await pumpAsProfile(
        tester,
        profile: TestProfile.tenant,
        handler: tenantApi,
      );
      expect(find.text("Fuite sous l'évier"), findsOneWidget);
      expect(find.text('Quittance de septembre'), findsOneWidget);
      expect(find.text('Non lue'), findsWidgets);
      expect(find.text('Fermée'), findsWidgets);
      expect(find.text('Nouveau message'), findsOneWidget);
      expect(find.text('Support eGuardImmo'), findsOneWidget);
      expect(find.textContaining('lecture seule'), findsNothing);
    });

    testWidgets('liste vide : message d’accueil et bouton d’écriture', (
      tester,
    ) async {
      await pumpAsProfile(
        tester,
        profile: TestProfile.tenant,
        handler: (call) => call.path == '/tenant/conversations'
            ? apiFixture('messages/tenant_threads_empty')
            : null,
      );
      expect(find.text('Aucune conversation'), findsOneWidget);
      expect(find.text('Nouveau message'), findsOneWidget);
    });

    testWidgets('429 : message du serveur avec l’attente et reprise', (
      tester,
    ) async {
      var limited = true;
      await pumpAsProfile(
        tester,
        profile: TestProfile.tenant,
        handler: (call) {
          if (call.path == '/tenant/conversations') {
            return limited
                ? apiProblem('messages/problem_rate_limited', status: 429)
                : apiFixture('messages/tenant_threads');
          }
          return null;
        },
      );
      expect(
        find.text('Trop de requêtes envoyées. Réessayez dans 42 s.'),
        findsOneWidget,
      );
      limited = false;
      await tester.tap(find.text('Réessayer'));
      await tester.pumpAndSettle();
      expect(find.text("Fuite sous l'évier"), findsOneWidget);
    });

    testWidgets('403 : message du serveur affiché', (tester) async {
      await pumpAsProfile(
        tester,
        profile: TestProfile.tenant,
        handler: (call) => call.path == '/tenant/conversations'
            ? problem(
                403,
                'email_unverified',
                'Confirmez votre adresse e-mail pour accéder à cet espace.',
              )
            : null,
      );
      expect(
        find.text('Confirmez votre adresse e-mail pour accéder à cet espace.'),
        findsOneWidget,
      );
    });

    testWidgets('filtre « Non lues » : requête avec unread=1', (tester) async {
      final harness = await pumpAsProfile(
        tester,
        profile: TestProfile.tenant,
        handler: tenantApi,
      );
      await tester.tap(find.text('Non lues'));
      await tester.pumpAndSettle();
      final last = harness.api.calls.lastWhere(
        (c) => c.path == '/tenant/conversations',
      );
      expect(last.query?['unread'], '1');
    });

    testWidgets('interrogation toutes les 30 s tant que l’onglet est visible', (
      tester,
    ) async {
      final harness = await pumpAsProfile(
        tester,
        profile: TestProfile.tenant,
        handler: tenantApi,
      );
      int lists() => harness.api.calls
          .where((c) => c.path == '/tenant/conversations')
          .length;
      final before = lists();
      await tester.pump(const Duration(seconds: 30));
      expect(lists(), before + 1);
    });

    testWidgets('320 px et texte x1,6 : aucun débordement', (tester) async {
      await pumpAsProfile(
        tester,
        profile: TestProfile.tenant,
        handler: tenantApi,
        size: const Size(320, 640),
        textScale: 1.6,
      );
      expect(tester.takeException(), isNull);
    });
  });

  group('autres profils', () {
    testWidgets('voyageur : seul le support est proposé', (tester) async {
      final harness = await pumpAsProfile(
        tester,
        profile: TestProfile.traveler,
        handler: (_) => null,
      );
      expect(find.text('Aucune conversation'), findsOneWidget);
      expect(find.text('Support eGuardImmo'), findsOneWidget);
      expect(
        harness.api.calls.where((c) => c.path.contains('conversations')),
        isEmpty,
      );
    });

    testWidgets('mandant : lecture seule annoncée, pas de bouton d’écriture', (
      tester,
    ) async {
      await pumpAsProfile(
        tester,
        profile: TestProfile.owner,
        handler: (call) => call.path == '/owner/conversations'
            ? apiFixture('messages/tenant_threads')
            : null,
      );
      expect(find.textContaining('lecture seule'), findsOneWidget);
      expect(find.text('Nouveau message'), findsNothing);
    });

    testWidgets('agence : onglets locataires et mandants, réponse attendue', (
      tester,
    ) async {
      final harness = await pumpAsProfile(
        tester,
        profile: TestProfile.agency,
        handler: (call) => call.path.endsWith('/conversations')
            ? apiFixture('messages/staff_threads')
            : null,
      );
      expect(find.text('Locataires'), findsOneWidget);
      expect(find.text('Mandants'), findsOneWidget);
      expect(find.text('Réponse attendue'), findsOneWidget);
      expect(find.text('Nouveau message'), findsNothing);
      await tester.tap(find.text('Mandants'));
      await tester.pumpAndSettle();
      final last = harness.api.calls.lastWhere(
        (c) => c.path.endsWith('/conversations'),
      );
      expect(last.query?['kind'], 'owner');
    });

    testWidgets('bailleur autonome : pas d’onglet mandants', (tester) async {
      await pumpAsProfile(
        tester,
        profile: TestProfile.landlord,
        handler: (call) => call.path.endsWith('/conversations')
            ? apiFixture('messages/staff_threads')
            : null,
      );
      expect(find.text('Mandants'), findsNothing);
    });
  });
}
