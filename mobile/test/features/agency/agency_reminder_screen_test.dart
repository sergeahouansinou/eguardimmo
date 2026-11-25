import 'package:eguardimmo/features/agency/agency_paths.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/agency_actions_api.dart';
import '../../helpers/agency_actions_harness.dart';
import '../../helpers/agency_api.dart';
import '../../helpers/api_fixtures.dart';
import '../../helpers/fakes.dart';

void main() {
  group('relance d’impayé', () {
    Map<String, Object?> unpaidWithCase() {
      final page = apiObject('agency/unpaid');
      final first =
          (page['data']! as List<Object?>).first! as Map<String, Object?>;
      first['case'] = {'id': caseId, 'number': 'REC-2026-0001'};
      return page;
    }

    testWidgets('parcours complet : acte du dossier, rien n’est envoyé au '
        'locataire', (tester) async {
      final server = ActionsApi()..unpaid = unpaidWithCase();
      final (app, _) = await openIntervention(
        tester,
        server: server,
        path: AgencyPaths.unpaid,
      );
      expect(find.text('Relancer'), findsOneWidget);
      expect(
        find.textContaining('Aucun dossier de recouvrement'),
        findsNWidgets(2),
      );
      await tapText(tester, 'Relancer');
      await tapText(tester, 'Appel');
      await tester.enterText(sheetField(), 'Pas de réponse.');
      await tapText(tester, 'Continuer');
      expect(find.text('Enregistrer cette relance ?'), findsOneWidget);
      expect(find.textContaining('aucun message n’est envoyé'), findsOneWidget);
      expect(postsOf(app), isEmpty);

      await tapText(tester, 'Confirmer la relance');
      final post = postsOf(app).single;
      expect(post.path, '/org/$agencyOrgId/recovery/cases/$caseId/acts');
      final body = post.body! as Map<String, Object?>;
      expect(body['type'], 'call');
      expect(body['note'], 'Pas de réponse.');
      expect(body['performed_on'], matches(RegExp(r'^\d{4}-\d{2}-\d{2}$')));
      expect(post.headers!['Idempotency-Key'], isNotEmpty);
      expect(find.text('Relance enregistrée.'), findsOneWidget);
    });

    testWidgets('confirmation annulée : aucune requête', (tester) async {
      final server = ActionsApi()..unpaid = unpaidWithCase();
      final (app, _) = await openIntervention(
        tester,
        server: server,
        path: AgencyPaths.unpaid,
      );
      await tapText(tester, 'Relancer');
      await tapText(tester, 'Continuer');
      await tapText(tester, 'Revenir');
      expect(postsOf(app), isEmpty);
    });

    testWidgets('422 : message du serveur, aucun succès annoncé', (
      tester,
    ) async {
      final server = ActionsApi()..unpaid = unpaidWithCase();
      server.script['POST /recovery/cases/$caseId/acts'] = [
        problem(422, 'validation_failed', 'La date ne peut pas être future.'),
      ];
      await openIntervention(tester, server: server, path: AgencyPaths.unpaid);
      await tapText(tester, 'Relancer');
      await tapText(tester, 'Continuer');
      await tapText(tester, 'Confirmer la relance');
      expect(find.text('La date ne peut pas être future.'), findsOneWidget);
      expect(find.text('Relance enregistrée.'), findsNothing);
    });

    testWidgets('sans dossier de recouvrement : pas de bouton, raison dite', (
      tester,
    ) async {
      await openIntervention(tester, path: AgencyPaths.unpaid);
      expect(find.text('Relancer'), findsNothing);
      expect(
        find.textContaining('Aucun dossier de recouvrement'),
        findsWidgets,
      );
    });

    testWidgets('comptable : lecture seule, pas de bouton', (tester) async {
      final server = ActionsApi()
        ..unpaid = unpaidWithCase()
        ..roles = 'agency/roles_accountant';
      await openIntervention(tester, server: server, path: AgencyPaths.unpaid);
      expect(find.text('Relancer'), findsNothing);
      expect(find.textContaining('Lecture seule'), findsWidgets);
    });
  });
}
