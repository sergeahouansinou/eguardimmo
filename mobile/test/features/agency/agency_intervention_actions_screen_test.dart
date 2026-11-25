import 'dart:async';

import 'package:eguardimmo/core/routes/app_routes.dart';
import 'package:eguardimmo/core/routes/route_args.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/agency_actions_api.dart';
import '../../helpers/agency_actions_harness.dart';
import '../../helpers/api_fixtures.dart';
import '../../helpers/fakes.dart';
import '../../helpers/fixtures.dart';
import '../../helpers/harness.dart';

void main() {
  group('annuler', () {
    testWidgets('confirmation refusée : aucune requête', (tester) async {
      final (app, _) = await openIntervention(tester);
      await tapText(tester, 'Annuler l’intervention');
      expect(find.text('Annuler cette intervention ?'), findsOneWidget);
      await tapText(tester, 'Conserver');
      expect(postsOf(app), isEmpty);
    });

    testWidgets('confirmée : requête puis fiche relue', (tester) async {
      final cancelled = apiObject('agency/intervention_reported');
      (cancelled['data']! as Map<String, Object?>)
        ..['status'] = 'cancelled'
        ..['lock_version'] = 2;
      final server = serverWith('agency/intervention_reported');
      server.afterWrite = cancelled;
      final (app, _) = await openIntervention(tester, server: server);
      await tapText(tester, 'Annuler l’intervention');
      await tapText(tester, 'Confirmer l’annulation');
      expect(postsOf(app).single.path, '$interventionPath/cancel');
      expect(postsOf(app).single.body, {'lock_version': 1});
      expect(find.text('Intervention annulée.'), findsOneWidget);
      expect(find.text('Annulée'), findsOneWidget);
      expect(find.text('Annuler l’intervention'), findsNothing);
    });

    testWidgets('409 fiche modifiée : message affiché et fiche à jour', (
      tester,
    ) async {
      final server = serverWith('agency/intervention_reported');
      server.script['POST /interventions/$interventionId/cancel'] = [
        apiProblem('agency/problem_stale_version', status: 409),
      ];
      final (app, _) = await openIntervention(tester, server: server);
      server.detail = apiFixture('agency/intervention_qualified');
      await tapText(tester, 'Annuler l’intervention');
      await tapText(tester, 'Confirmer l’annulation');
      expect(find.text('Intervention modifiée entre-temps.'), findsOneWidget);
      expect(find.text('Qualifiée'), findsOneWidget);
      expect(find.text('Assigner un prestataire'), findsOneWidget);
      expect(postsOf(app), hasLength(1));
    });

    testWidgets('double soumission : une seule requête, boutons bloqués', (
      tester,
    ) async {
      final gate = Completer<Object?>();
      final server = serverWith('agency/intervention_reported');
      final app = await pumpApp(
        tester,
        handler: (call) {
          if (call.method == 'POST') return gate.future;
          return server.call(call);
        },
        size: const Size(390, 3600),
        profiles: [Fixtures.organizationProfile(kind: 'agency')],
      );
      await tester.tap(find.text('Profil : Voyageur'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Agence Rhône Immo'));
      await tester.pumpAndSettle();
      app.router.go(
        RouteName.agencyIntervention,
        arguments: const ResourceArgs(interventionId),
      );
      await tester.pumpAndSettle();

      await tapText(tester, 'Annuler l’intervention');
      await tester.tap(find.text('Confirmer l’annulation'));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      expect(find.byType(CircularProgressIndicator), findsWidgets);
      expect(find.text('Qualifier'), findsNothing);
      for (final button in find.byType(FilledButton).evaluate()) {
        expect((button.widget as FilledButton).onPressed, isNull);
      }
      expect(postsOf(app), hasLength(1));
      gate.complete(server.detail);
      await tester.pumpAndSettle();
    });
  });

  group('devis', () {
    testWidgets('accepter : montant dans la confirmation, envoi, succès', (
      tester,
    ) async {
      final (app, _) = await openIntervention(
        tester,
        server: serverWith(
          'agency/intervention_quoting',
          after: 'agency/intervention_awaiting_approval',
        ),
      );
      expect(find.text('DEV-2026-0007'), findsOneWidget);
      await tapText(tester, 'Accepter ce devis');
      expect(find.text('Accepter ce devis ?'), findsOneWidget);
      expect(find.textContaining('DEV-2026-0007'), findsWidgets);
      expect(postsOf(app), isEmpty);

      await tapText(tester, 'Confirmer l’acceptation');
      final post = postsOf(app).single;
      expect(post.path, '$interventionPath/quotes/$quoteId/accept');
      expect(find.text('Devis accepté.'), findsOneWidget);
    });

    testWidgets('422 accord du mandant requis : message du serveur', (
      tester,
    ) async {
      final server = serverWith('agency/intervention_quoting');
      server.script['POST /interventions/$interventionId/quotes/$quoteId/accept'] =
          [apiProblem('agency/problem_approval_required', status: 422)];
      await openIntervention(tester, server: server);
      await tapText(tester, 'Accepter ce devis');
      await tapText(tester, 'Confirmer l’acceptation');
      expect(find.text('Accord du mandant requis.'), findsOneWidget);
      expect(find.text('Devis accepté.'), findsNothing);
    });

    testWidgets('confirmation annulée : aucune requête', (tester) async {
      final (app, _) = await openIntervention(
        tester,
        server: serverWith('agency/intervention_quoting'),
      );
      await tapText(tester, 'Accepter ce devis');
      await tapText(tester, 'Revenir');
      expect(postsOf(app), isEmpty);
    });
  });

  group('décision d’approbation', () {
    testWidgets('enregistrer : pièce choisie, confirmation, envoi', (
      tester,
    ) async {
      final (app, _) = await openIntervention(
        tester,
        server: serverWith('agency/intervention_awaiting_approval'),
      );
      await tapText(tester, 'Enregistrer la décision');
      expect(find.text('Décision du propriétaire'), findsOneWidget);
      await tester.enterText(sheetField(), 'Accord par courrier.');
      await tapText(tester, 'Continuer');
      expect(find.text('Enregistrer cette décision ?'), findsOneWidget);
      expect(postsOf(app), isEmpty);

      await tapText(tester, 'Confirmer la décision');
      final post = postsOf(app).single;
      expect(
        post.path,
        '$interventionPath/approvals/$approvalId/record-decision',
      );
      expect(post.body, {
        'decision': 'accept',
        'comment': 'Accord par courrier.',
        'proof_file_id': proofId,
      });
      expect(find.text('Décision enregistrée.'), findsOneWidget);
    });

    testWidgets('sans pièce écrite : bouton désactivé et raison dite', (
      tester,
    ) async {
      final fixture = apiObject('agency/intervention_awaiting_approval');
      (fixture['data']! as Map<String, Object?>)['files'] = <Object?>[];
      final server = ActionsApi()..detail = fixture;
      await openIntervention(tester, server: server);
      final button = tester.widget<FilledButton>(
        find.widgetWithText(FilledButton, 'Enregistrer la décision'),
      );
      expect(button.onPressed, isNull);
      expect(find.textContaining('Aucune pièce écrite'), findsOneWidget);
    });

    testWidgets('422 pièce requise : message du serveur', (tester) async {
      final server = serverWith('agency/intervention_awaiting_approval');
      server.script['POST /interventions/$interventionId/approvals/$approvalId/record-decision'] =
          [apiProblem('agency/problem_proof_required', status: 422)];
      await openIntervention(tester, server: server);
      await tapText(tester, 'Enregistrer la décision');
      await tapText(tester, 'Continuer');
      await tapText(tester, 'Confirmer la décision');
      expect(find.text('Pièce écrite du mandant requise.'), findsOneWidget);
      expect(find.text('Décision enregistrée.'), findsNothing);
    });

    testWidgets('retirer : confirmation puis envoi', (tester) async {
      final (app, _) = await openIntervention(
        tester,
        server: serverWith('agency/intervention_awaiting_approval'),
      );
      await tapText(tester, 'Retirer la demande d’accord');
      expect(find.text('Retirer la demande d’accord ?'), findsOneWidget);
      expect(postsOf(app), isEmpty);
      await tapText(tester, 'Confirmer le retrait');
      expect(
        postsOf(app).single.path,
        '$interventionPath/approvals/$approvalId/withdraw',
      );
      expect(find.text('Demande d’accord retirée.'), findsOneWidget);
    });

    testWidgets('retirer : 409 déjà tranchée, message affiché', (tester) async {
      final server = serverWith('agency/intervention_awaiting_approval');
      server.script['POST /interventions/$interventionId/approvals/$approvalId/withdraw'] =
          [apiProblem('agency/problem_transition_invalid', status: 409)];
      await openIntervention(tester, server: server);
      await tapText(tester, 'Retirer la demande d’accord');
      await tapText(tester, 'Confirmer le retrait');
      expect(find.text('Transition d\'état interdite.'), findsOneWidget);
      expect(find.text('Demande d’accord retirée.'), findsNothing);
    });
  });

  group('commentaire', () {
    testWidgets('publication : visibilité confirmée, champ vidé', (
      tester,
    ) async {
      final (app, _) = await openIntervention(tester);
      await tester.enterText(
        find.byType(TextFormField).first,
        'Prestataire prévenu.',
      );
      await tapText(tester, 'Visible par le locataire');
      await tapText(tester, 'Publier le commentaire');
      expect(find.text('Publier ce commentaire ?'), findsOneWidget);
      expect(find.textContaining('le locataire'), findsWidgets);
      expect(postsOf(app), isEmpty);

      await tapText(tester, 'Confirmer la publication');
      final post = postsOf(app).single;
      expect(post.path, '$interventionPath/comments');
      expect(post.body, {
        'text': 'Prestataire prévenu.',
        'visible_to_tenant': true,
        'visible_to_owner': false,
      });
      expect(find.text('Commentaire publié.'), findsOneWidget);
      expect(find.text('Prestataire prévenu.'), findsNothing);
    });

    testWidgets('commentaire vide : message, aucune confirmation', (
      tester,
    ) async {
      final (app, _) = await openIntervention(tester);
      await tapText(tester, 'Publier le commentaire');
      expect(
        find.text('Écrivez un commentaire avant de publier.'),
        findsOneWidget,
      );
      expect(find.text('Publier ce commentaire ?'), findsNothing);
      expect(postsOf(app), isEmpty);
    });

    testWidgets('échec réseau : texte conservé pour un nouvel essai', (
      tester,
    ) async {
      final server = ActionsApi();
      server.script['POST /interventions/$interventionId/comments'] = [
        networkFailure(),
      ];
      final (app, _) = await openIntervention(tester, server: server);
      await tester.enterText(
        find.byType(TextFormField).first,
        'Passage jeudi.',
      );
      await tapText(tester, 'Publier le commentaire');
      await tapText(tester, 'Confirmer la publication');
      expect(find.textContaining('Connexion impossible'), findsOneWidget);
      expect(find.text('Commentaire publié.'), findsNothing);
      expect(find.text('Passage jeudi.'), findsOneWidget);

      await tapText(tester, 'Publier le commentaire');
      await tapText(tester, 'Confirmer la publication');
      final keys = postsOf(app).map((c) => c.headers!['Idempotency-Key']);
      expect(keys.toSet(), hasLength(1));
      expect(find.text('Commentaire publié.'), findsOneWidget);
    });
  });
}
