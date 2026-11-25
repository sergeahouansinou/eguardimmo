import 'package:eguardimmo/core/state/idempotent_writes.dart';
import 'package:eguardimmo/features/agency/models/intervention_commands.dart';
import 'package:eguardimmo/features/agency/services/agency_maintenance_service.dart';
import 'package:eguardimmo/features/agency/viewmodels/agency_intervention_viewmodel.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/agency_actions_api.dart';
import '../../helpers/agency_api.dart';
import '../../helpers/api_fixtures.dart';
import '../../helpers/fakes.dart';

final _uuid = RegExp(
  r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
);

Future<(FakeApiClient, ActionsApi, AgencyInterventionViewModel)> _open({
  String fixture = 'agency/intervention_reported',
  String? afterFixture,
  String organization = '',
}) async {
  final server = ActionsApi()..detail = apiFixture(fixture);
  if (afterFixture != null) server.afterWrite = apiFixture(afterFixture);
  final api = FakeApiClient(server.call);
  final viewModel = AgencyInterventionViewModel(
    AgencyMaintenanceService(api),
    organization.isEmpty ? agencyOrgId : organization,
    interventionId,
  );
  await viewModel.load();
  return (api, server, viewModel);
}

List<RecordedCall> _posts(FakeApiClient api) =>
    api.calls.where((c) => c.method == 'POST').toList();

void main() {
  group('devis', () {
    test('accepter : POST sans corps sur le devis, puis relecture', () async {
      final (api, _, viewModel) = await _open(
        fixture: 'agency/intervention_quoting',
      );
      final result = await viewModel.acceptQuote(quoteId);
      expect(result, isA<WriteDone>());
      final post = _posts(api).single;
      expect(post.path, '$interventionPath/quotes/$quoteId/accept');
      expect(post.body, isNull);
      expect(post.headers!['Idempotency-Key'], matches(_uuid));
    });

    test('accepter : 422 accord du mandant requis', () async {
      final (_, server, viewModel) = await _open(
        fixture: 'agency/intervention_quoting',
      );
      server.script['POST /interventions/$interventionId/quotes/$quoteId/accept'] =
          [apiProblem('agency/problem_approval_required', status: 422)];
      final result = await viewModel.acceptQuote(quoteId);
      expect((result as WriteRefused).message, 'Accord du mandant requis.');
    });

    test('devis non UUID : aucune requête d’écriture', () async {
      final (api, _, viewModel) = await _open(
        fixture: 'agency/intervention_quoting',
      );
      expect(await viewModel.acceptQuote('1/../2'), isA<WriteRefused>());
      expect(_posts(api), isEmpty);
    });
  });

  group('décision d’approbation', () {
    const command = DecisionCommand(
      approvalId: approvalId,
      decision: ApprovalDecision.accept,
      proofFileId: proofId,
      comment: 'Accord par courrier.',
    );

    test('enregistrer : décision, pièce et commentaire', () async {
      final (api, _, viewModel) = await _open(
        fixture: 'agency/intervention_awaiting_approval',
      );
      final result = await viewModel.recordDecision(command);
      expect(result, isA<WriteDone>());
      final post = _posts(api).single;
      expect(
        post.path,
        '$interventionPath/approvals/$approvalId/record-decision',
      );
      expect(post.body, {
        'decision': 'accept',
        'comment': 'Accord par courrier.',
        'proof_file_id': proofId,
      });
      expect(post.headers!['Idempotency-Key'], matches(_uuid));
    });

    test('enregistrer : commentaire vide non envoyé', () async {
      final (api, _, viewModel) = await _open(
        fixture: 'agency/intervention_awaiting_approval',
      );
      await viewModel.recordDecision(
        const DecisionCommand(
          approvalId: approvalId,
          decision: ApprovalDecision.refuse,
          proofFileId: proofId,
        ),
      );
      final body = _posts(api).single.body! as Map<String, Object?>;
      expect(body.containsKey('comment'), isFalse);
      expect(body['decision'], 'refuse');
    });

    test('enregistrer : 422 pièce requise', () async {
      final (_, server, viewModel) = await _open(
        fixture: 'agency/intervention_awaiting_approval',
      );
      server.script['POST /interventions/$interventionId/approvals/$approvalId/record-decision'] =
          [apiProblem('agency/problem_proof_required', status: 422)];
      final result = await viewModel.recordDecision(command);
      expect(
        (result as WriteRefused).message,
        'Pièce écrite du mandant requise.',
      );
    });

    test('retirer : POST sans corps puis relecture', () async {
      final (api, _, viewModel) = await _open(
        fixture: 'agency/intervention_awaiting_approval',
      );
      final result = await viewModel.withdrawApproval(approvalId);
      expect(result, isA<WriteDone>());
      final post = _posts(api).single;
      expect(post.path, '$interventionPath/approvals/$approvalId/withdraw');
      expect(post.body, isNull);
    });

    test('retirer : 409 demande déjà tranchée', () async {
      final (_, server, viewModel) = await _open(
        fixture: 'agency/intervention_awaiting_approval',
      );
      server.script['POST /interventions/$interventionId/approvals/$approvalId/withdraw'] =
          [apiProblem('agency/problem_transition_invalid', status: 409)];
      final result = await viewModel.withdrawApproval(approvalId);
      expect((result as WriteRefused).message, 'Transition d\'état interdite.');
    });
  });

  group('commenter', () {
    test('nominal : visibilité explicite', () async {
      final (api, _, viewModel) = await _open();
      final result = await viewModel.comment(
        const CommentCommand(
          text: 'Prestataire prévenu.',
          visibleToTenant: true,
        ),
      );
      expect(result, isA<WriteDone>());
      final post = _posts(api).single;
      expect(post.path, '$interventionPath/comments');
      expect(post.body, {
        'text': 'Prestataire prévenu.',
        'visible_to_tenant': true,
        'visible_to_owner': false,
      });
      expect(post.headers!['Idempotency-Key'], matches(_uuid));
    });
  });
}
