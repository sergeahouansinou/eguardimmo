import 'package:eguardimmo/features/agency/agency_paths.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/agency_actions_api.dart';
import '../../helpers/agency_actions_harness.dart';
import '../../helpers/api_fixtures.dart';
import '../../helpers/fakes.dart';

void main() {
  group('fiche d’intervention', () {
    testWidgets('depuis la liste : carte cliquable, fiche et actions', (
      tester,
    ) async {
      final (app, _) = await openIntervention(
        tester,
        path: AgencyPaths.interventions,
      );
      await tapText(tester, 'Prise électrique HS');
      expect(
        app.router.state.uri.path,
        AgencyPaths.intervention(interventionId),
      );
      expect(find.text('INT-2026-0004'), findsOneWidget);
      expect(find.text('Qualifier'), findsOneWidget);
      expect(find.text('Refuser la demande'), findsOneWidget);
      expect(find.text('Annuler l’intervention'), findsOneWidget);
      expect(find.text('Assigner un prestataire'), findsNothing);
    });

    testWidgets('statut qualifié : assigner, refuser, annuler', (tester) async {
      await openIntervention(
        tester,
        server: serverWith('agency/intervention_qualified'),
      );
      expect(find.text('Qualifier'), findsNothing);
      expect(find.text('Assigner un prestataire'), findsOneWidget);
      expect(find.text('Refuser la demande'), findsOneWidget);
      expect(find.text('Annuler l’intervention'), findsOneWidget);
    });

    testWidgets('comptable : lecture seule, aucune action', (tester) async {
      await openIntervention(
        tester,
        server: serverWith(
          'agency/intervention_awaiting_approval',
          roles: 'agency/roles_accountant',
        ),
      );
      expect(find.textContaining('Lecture seule'), findsOneWidget);
      expect(find.text('Annuler l’intervention'), findsNothing);
      expect(find.text('Accepter ce devis'), findsNothing);
      expect(find.text('Enregistrer la décision'), findsNothing);
      expect(find.text('Publier le commentaire'), findsNothing);
    });

    testWidgets('droits illisibles : message et reprise, aucune action', (
      tester,
    ) async {
      final server = ActionsApi();
      server.script['GET /roles'] = [
        problem(500, 'server_error', 'Service indisponible.'),
      ];
      await openIntervention(tester, server: server);
      expect(find.textContaining('Droits indisponibles'), findsOneWidget);
      expect(find.text('Réessayer'), findsOneWidget);
      expect(find.text('Annuler l’intervention'), findsNothing);
    });

    testWidgets('fiche introuvable : message du serveur et reprise', (
      tester,
    ) async {
      final server = ActionsApi();
      server.script['GET /interventions/$interventionId'] = [
        problem(404, 'intervention_not_found', 'Intervention introuvable.'),
      ];
      await openIntervention(tester, server: server);
      expect(find.text('Intervention introuvable.'), findsOneWidget);
      expect(find.text('Réessayer'), findsOneWidget);
    });

    testWidgets('320 px et texte agrandi : aucun débordement', (tester) async {
      await openIntervention(
        tester,
        server: serverWith('agency/intervention_awaiting_approval'),
        size: const Size(320, 3600),
        textScale: 1.6,
      );
      expect(tester.takeException(), isNull);
    });
  });

  group('qualifier', () {
    testWidgets(
      'parcours complet : saisie, confirmation, envoi, état serveur',
      (tester) async {
        final (app, _) = await openIntervention(
          tester,
          server: serverWith(
            'agency/intervention_reported',
            after: 'agency/intervention_qualified',
          ),
        );
        await tapText(tester, 'Qualifier');
        expect(find.text('Qualifier l’intervention'), findsOneWidget);
        await tapText(tester, 'Urgente');
        await tapText(tester, 'Propriétaire');
        await tapText(tester, 'Continuer');
        expect(find.text('Qualifier cette intervention ?'), findsOneWidget);
        expect(find.textContaining('Priorité : Urgente'), findsOneWidget);
        expect(
          postsOf(app),
          isEmpty,
          reason: 'rien n’est envoyé avant confirmation',
        );

        await tapText(tester, 'Confirmer la qualification');
        final post = postsOf(app).single;
        expect(post.path, '$interventionPath/qualify');
        expect(post.body, {
          'lock_version': 1,
          'priority': 'urgent',
          'responsibility': 'owner',
        });
        expect(post.headers!['Idempotency-Key'], isNotEmpty);
        expect(find.text('Intervention qualifiée.'), findsOneWidget);
        expect(find.text('Qualifiée'), findsOneWidget);
        expect(find.text('Qualifier'), findsNothing);
      },
    );

    testWidgets('422 : message du serveur, jamais de succès', (tester) async {
      final server = serverWith('agency/intervention_reported');
      server.script['POST /interventions/$interventionId/qualify'] = [
        apiProblem('agency/problem_approval_required', status: 422),
      ];
      final (app, _) = await openIntervention(tester, server: server);
      await tapText(tester, 'Qualifier');
      await tapText(tester, 'Continuer');
      await tapText(tester, 'Confirmer la qualification');
      expect(find.text('Accord du mandant requis.'), findsOneWidget);
      expect(find.text('Intervention qualifiée.'), findsNothing);
      expect(find.text('Qualifier'), findsOneWidget);
      expect(postsOf(app), hasLength(1));
    });

    testWidgets('confirmation annulée : aucune requête', (tester) async {
      final (app, _) = await openIntervention(tester);
      await tapText(tester, 'Qualifier');
      await tapText(tester, 'Continuer');
      await tapText(tester, 'Revenir');
      expect(postsOf(app), isEmpty);
      expect(find.text('Qualifier'), findsOneWidget);
    });
  });

  group('refuser', () {
    testWidgets('note obligatoire côté saisie, puis parcours complet', (
      tester,
    ) async {
      final (app, _) = await openIntervention(
        tester,
        server: serverWith(
          'agency/intervention_reported',
          after: 'agency/intervention_qualified',
        ),
      );
      await tapText(tester, 'Refuser la demande');
      await tapText(tester, 'Continuer');
      expect(find.textContaining('Expliquez le refus'), findsOneWidget);
      expect(find.text('Refuser cette demande ?'), findsNothing);

      await tapText(tester, 'Doublon');
      await tester.enterText(sheetField(), 'Déjà signalée hier.');
      await tapText(tester, 'Continuer');
      expect(find.text('Refuser cette demande ?'), findsOneWidget);
      expect(postsOf(app), isEmpty);

      await tapText(tester, 'Confirmer le refus');
      final post = postsOf(app).single;
      expect(post.path, '$interventionPath/decline');
      expect(post.body, {
        'lock_version': 1,
        'reason': 'duplicate',
        'note': 'Déjà signalée hier.',
      });
      expect(find.text('Demande refusée.'), findsOneWidget);
    });

    testWidgets('403 : message du serveur affiché', (tester) async {
      final server = serverWith('agency/intervention_reported');
      server.script['POST /interventions/$interventionId/decline'] = [
        apiProblem('agency/problem_role_forbidden', status: 403),
      ];
      await openIntervention(tester, server: server);
      await tapText(tester, 'Refuser la demande');
      await tester.enterText(sheetField(), 'Hors périmètre');
      await tapText(tester, 'Continuer');
      await tapText(tester, 'Confirmer le refus');
      expect(
        find.text('Votre rôle ne permet pas cette action.'),
        findsOneWidget,
      );
      expect(find.text('Demande refusée.'), findsNothing);
    });
  });

  group('assigner', () {
    testWidgets('prestataires actifs, confirmation nommée, envoi', (
      tester,
    ) async {
      final (app, _) = await openIntervention(
        tester,
        server: serverWith(
          'agency/intervention_qualified',
          after: 'agency/intervention_quoting',
        ),
      );
      await tapText(tester, 'Assigner un prestataire');
      expect(find.text('Plomberie Sow'), findsOneWidget);
      expect(find.text('Électricité Kané'), findsOneWidget);
      await tapText(tester, 'Continuer');
      expect(find.text('Choisissez un prestataire.'), findsOneWidget);

      await tapText(tester, 'Plomberie Sow');
      await tapText(tester, 'Continuer');
      expect(find.text('Assigner à Plomberie Sow ?'), findsOneWidget);
      expect(postsOf(app), isEmpty);

      await tapText(tester, 'Confirmer l’assignation');
      final post = postsOf(app).single;
      expect(post.path, '$interventionPath/assign');
      expect(post.body, {
        'lock_version': 2,
        'supplier_party_id': supplierPartyId,
      });
      expect(find.text('Prestataire assigné.'), findsOneWidget);
    });

    testWidgets('liste des prestataires en échec : message et reprise', (
      tester,
    ) async {
      final server = serverWith('agency/intervention_qualified');
      server.script['GET /suppliers'] = [
        problem(
          403,
          'role_forbidden',
          'Votre rôle ne permet pas cette action.',
        ),
      ];
      await openIntervention(tester, server: server);
      await tapText(tester, 'Assigner un prestataire');
      expect(
        find.text('Votre rôle ne permet pas cette action.'),
        findsOneWidget,
      );
      expect(find.text('Réessayer'), findsOneWidget);
    });
  });
}
