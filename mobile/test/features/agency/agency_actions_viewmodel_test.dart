import 'package:eguardimmo/core/state/idempotent_writes.dart';
import 'package:eguardimmo/core/state/load_state.dart';
import 'package:eguardimmo/features/agency/models/agency_intervention.dart';
import 'package:eguardimmo/features/agency/models/intervention_commands.dart';
import 'package:eguardimmo/features/agency/models/intervention_detail.dart';
import 'package:eguardimmo/features/agency/services/agency_access_service.dart';
import 'package:eguardimmo/features/agency/services/agency_maintenance_service.dart';
import 'package:eguardimmo/features/agency/viewmodels/agency_access_viewmodels.dart';
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
  group('lecture de la fiche', () {
    test('fiche à qualifier : champs, version et listes vides', () async {
      final (api, _, viewModel) = await _open();
      final detail = viewModel.state.dataOrNull!;
      expect(api.calls.single.path, interventionPath);
      expect(detail.status, InterventionStatus.reported);
      expect(detail.lockVersion, 1);
      expect(detail.quotes, isEmpty);
      expect(detail.approvals, isEmpty);
      expect(detail.summary.reference, 'INT-2026-0004');
    });

    test('devis soumis et demande d’accord en attente', () async {
      final (_, _, viewModel) = await _open(
        fixture: 'agency/intervention_awaiting_approval',
      );
      final detail = viewModel.state.dataOrNull!;
      expect(detail.quotes.single.status.acceptable, isTrue);
      expect(detail.quotes.single.totalGross.minor, 23600000);
      expect(detail.approvals.single.status.isOpen, isTrue);
      expect(detail.supplierPartyId, supplierPartyId);
      expect(detail.availableProofs.map((f) => f.id), [proofId, usedProofId]);
    });

    test('pièce déjà rattachée à une décision : non proposée', () async {
      final fixture = apiObject('agency/intervention_awaiting_approval');
      final data = fixture['data']! as Map<String, Object?>;
      final approval =
          (data['approvals']! as List<Object?>).single! as Map<String, Object?>;
      approval['proof_file_id'] = usedProofId;
      final server = ActionsApi()..detail = fixture;
      final viewModel = AgencyInterventionViewModel(
        AgencyMaintenanceService(FakeApiClient(server.call)),
        agencyOrgId,
        interventionId,
      );
      await viewModel.load();
      expect(viewModel.state.dataOrNull!.availableProofs.map((f) => f.id), [
        proofId,
      ]);
    });

    test('statut inconnu : échec visible, pas de valeur par défaut', () async {
      final fixture = apiObject('agency/intervention_reported');
      (fixture['data']! as Map<String, Object?>)['status'] = 'mystere';
      final server = ActionsApi()..detail = fixture;
      final viewModel = AgencyInterventionViewModel(
        AgencyMaintenanceService(FakeApiClient(server.call)),
        agencyOrgId,
        interventionId,
      );
      await viewModel.load();
      expect(viewModel.state, isA<Failed<Object?>>());
    });

    test('identifiant non UUID : aucune requête', () async {
      final api = FakeApiClient(ActionsApi().call);
      final viewModel = AgencyInterventionViewModel(
        AgencyMaintenanceService(api),
        agencyOrgId,
        '../../admin',
      );
      await viewModel.load();
      expect(api.calls, isEmpty);
      expect(viewModel.state, isA<Failed<Object?>>());
    });

    test('segment d’organisation invalide : aucune requête', () async {
      final (api, _, viewModel) = await _open(organization: '../admin');
      expect(api.calls, isEmpty);
      expect(viewModel.state, isA<Failed<Object?>>());
    });

    test('prestataires actifs : filtre serveur, pagination', () async {
      final api = FakeApiClient(ActionsApi().call);
      final viewModel = AgencySuppliersViewModel(
        AgencyMaintenanceService(api),
        agencyOrgId,
      );
      await viewModel.load();
      expect(api.calls.single.path, '/org/$agencyOrgId/suppliers');
      expect(api.calls.single.query, {'status': 'active', 'per_page': 100});
      final suppliers = viewModel.state.dataOrNull!;
      expect(suppliers.map((s) => s.name), [
        'Plomberie Sow',
        'Électricité Kané',
      ]);
      expect(suppliers.first.partyId, supplierPartyId);
    });
  });

  group('droits (matrice de rôles)', () {
    Future<AgencyAccessViewModel> access(String fixture) async {
      final server = ActionsApi()..roles = fixture;
      final viewModel = AgencyAccessViewModel(
        AgencyAccessService(FakeApiClient(server.call)),
        agencyOrgId,
      );
      await viewModel.load();
      return viewModel;
    }

    test('gestionnaire : écriture sur interventions et recouvrement', () async {
      final data = (await access('agency/roles_manager')).state.dataOrNull!;
      expect(data.role, 'manager');
      expect(data.maintenanceWrite, isTrue);
      expect(data.recoveryWrite, isTrue);
    });

    test('comptable : lecture seule', () async {
      final data = (await access('agency/roles_accountant')).state.dataOrNull!;
      expect(data.role, 'accountant');
      expect(data.maintenanceWrite, isFalse);
      expect(data.recoveryWrite, isFalse);
    });
  });

  group('qualifier', () {
    test('nominal : POST avec lock_version, clé, puis fiche relue', () async {
      final (api, _, viewModel) = await _open(
        afterFixture: 'agency/intervention_qualified',
      );
      final result = await viewModel.qualify(
        QualifyCommand(
          priority: InterventionPriority.urgent,
          responsibility: Responsibility.owner,
          dueOn: DateTime(2026, 12, 5),
        ),
      );
      expect(result, isA<WriteDone>());
      final post = _posts(api).single;
      expect(post.path, '$interventionPath/qualify');
      expect(post.body, {
        'lock_version': 1,
        'priority': 'urgent',
        'responsibility': 'owner',
        'due_on': '2026-12-05',
      });
      expect(post.headers!['Idempotency-Key'], matches(_uuid));
      expect(api.calls.last.method, 'GET');
      expect(
        viewModel.state.dataOrNull!.status,
        InterventionStatus.qualified,
        reason: 'le statut affiché est celui que le serveur renvoie',
      );
      expect(viewModel.state.dataOrNull!.lockVersion, 2);
    });

    test('l’estimation existante est renvoyée telle quelle', () async {
      final (api, _, viewModel) = await _open(
        fixture: 'agency/intervention_qualified',
      );
      await viewModel.qualify(
        const QualifyCommand(
          priority: InterventionPriority.normal,
          responsibility: Responsibility.shared,
        ),
      );
      final body = _posts(api).single.body! as Map<String, Object?>;
      expect(body['estimated_amount'], 8000000);
      expect(body['lock_version'], 2);
      expect(body.containsKey('due_on'), isFalse);
    });

    test('422 : message du serveur, pas de relecture', () async {
      final (api, server, viewModel) = await _open();
      server.script['POST /interventions/$interventionId/qualify'] = [
        apiProblem('agency/problem_approval_required', status: 422),
      ];
      final result = await viewModel.qualify(
        const QualifyCommand(
          priority: InterventionPriority.normal,
          responsibility: Responsibility.owner,
        ),
      );
      expect(result, isA<WriteRefused>());
      expect((result as WriteRefused).message, 'Accord du mandant requis.');
      expect(result.status, 422);
      expect(api.calls.where((c) => c.method == 'GET'), hasLength(1));
    });
  });

  group('refuser', () {
    test('nominal : motif et note envoyés', () async {
      final (api, _, viewModel) = await _open(
        afterFixture: 'agency/intervention_qualified',
      );
      final result = await viewModel.decline(
        const DeclineCommand(
          reason: DeclineReason.duplicate,
          note: 'Déjà signalée hier.',
        ),
      );
      expect(result, isA<WriteDone>());
      final post = _posts(api).single;
      expect(post.path, '$interventionPath/decline');
      expect(post.body, {
        'lock_version': 1,
        'reason': 'duplicate',
        'note': 'Déjà signalée hier.',
      });
      expect(post.headers!['Idempotency-Key'], matches(_uuid));
    });

    test('403 : message du serveur affiché, aucune relecture', () async {
      final (api, server, viewModel) = await _open();
      server.script['POST /interventions/$interventionId/decline'] = [
        apiProblem('agency/problem_role_forbidden', status: 403),
      ];
      final result = await viewModel.decline(
        const DeclineCommand(reason: DeclineReason.other, note: 'Hors sujet'),
      );
      expect(
        (result as WriteRefused).message,
        'Votre rôle ne permet pas cette action.',
      );
      expect(api.calls.where((c) => c.method == 'GET'), hasLength(1));
    });
  });

  group('fiche modifiée entre-temps (409)', () {
    for (final (name, call) in <(String, String)>[
      ('refus', 'decline'),
      ('assignation', 'assign'),
      ('qualification', 'qualify'),
    ]) {
      test(
        '$name : refus affiché, fiche relue, nouvelle version utilisée',
        () async {
          final (api, server, viewModel) = await _open(
            fixture: 'agency/intervention_qualified',
          );
          server.script['POST /interventions/$interventionId/$call'] = [
            apiProblem('agency/problem_stale_version', status: 409),
          ];
          server.detail = apiFixture('agency/intervention_quoting');
          final result = switch (call) {
            'decline' => await viewModel.decline(
              const DeclineCommand(
                reason: DeclineReason.other,
                note: 'Hors sujet',
              ),
            ),
            'assign' => await viewModel.assign(supplierPartyId),
            _ => await viewModel.qualify(
              const QualifyCommand(
                priority: InterventionPriority.normal,
                responsibility: Responsibility.owner,
              ),
            ),
          };
          expect((result as WriteRefused).status, 409);
          expect(api.calls.last.method, 'GET');
          expect(viewModel.state.dataOrNull!.lockVersion, 3);
        },
      );
    }
  });

  group('assigner', () {
    test('nominal : supplier_party_id et version', () async {
      final (api, _, viewModel) = await _open(
        fixture: 'agency/intervention_qualified',
        afterFixture: 'agency/intervention_quoting',
      );
      final result = await viewModel.assign(supplierPartyId);
      expect(result, isA<WriteDone>());
      final post = _posts(api).single;
      expect(post.path, '$interventionPath/assign');
      expect(post.body, {
        'lock_version': 2,
        'supplier_party_id': supplierPartyId,
      });
      expect(viewModel.state.dataOrNull!.status, InterventionStatus.quoting);
    });

    test('prestataire non UUID : aucune requête d’écriture', () async {
      final (api, _, viewModel) = await _open(
        fixture: 'agency/intervention_qualified',
      );
      final result = await viewModel.assign('../x');
      expect(result, isA<WriteRefused>());
      expect(_posts(api), isEmpty);
    });
  });

  group('annuler', () {
    test('nominal : lock_version seule', () async {
      final (api, _, viewModel) = await _open();
      final result = await viewModel.cancel();
      expect(result, isA<WriteDone>());
      final post = _posts(api).single;
      expect(post.path, '$interventionPath/cancel');
      expect(post.body, {'lock_version': 1});
      expect(post.headers!['Idempotency-Key'], matches(_uuid));
    });

    test('409 fiche modifiée : refus affiché et fiche relue', () async {
      final (api, server, viewModel) = await _open();
      server.script['POST /interventions/$interventionId/cancel'] = [
        apiProblem('agency/problem_stale_version', status: 409),
      ];
      server.detail = apiFixture('agency/intervention_qualified');
      final result = await viewModel.cancel();
      expect(
        (result as WriteRefused).message,
        'Intervention modifiée entre-temps.',
      );
      expect(api.calls.last.method, 'GET');
      expect(viewModel.state.dataOrNull!.lockVersion, 2);
    });
  });
}
