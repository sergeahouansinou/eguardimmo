import 'dart:async';

import 'package:eguardimmo/core/services/api_exception.dart';
import 'package:eguardimmo/core/state/idempotent_writes.dart';
import 'package:eguardimmo/features/agency/models/intervention_commands.dart';
import 'package:eguardimmo/features/agency/services/agency_maintenance_service.dart';
import 'package:eguardimmo/features/agency/services/agency_service.dart';
import 'package:eguardimmo/features/agency/viewmodels/agency_intervention_viewmodel.dart';
import 'package:eguardimmo/features/agency/viewmodels/agency_viewmodels.dart';
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
  group('idempotence et double soumission', () {
    const note = DeclineCommand(
      reason: DeclineReason.other,
      note: 'Hors sujet',
    );
    const decline = 'POST /interventions/$interventionId/decline';

    test('double soumission : une seule requête d’écriture', () async {
      final (api, server, viewModel) = await _open();
      final gate = Completer<void>();
      final slow = FakeApiClient((call) {
        if (call.method == 'POST') return gate.future;
        return server.call(call);
      });
      final slowModel = AgencyInterventionViewModel(
        AgencyMaintenanceService(slow),
        agencyOrgId,
        interventionId,
      );
      await slowModel.load();
      final first = slowModel.cancel();
      expect(slowModel.busy, isTrue);
      expect(await slowModel.cancel(), isA<WriteIgnored>());
      gate.complete();
      await first;
      expect(slow.calls.where((c) => c.method == 'POST'), hasLength(1));
      expect(_posts(api), isEmpty);
      viewModel.dispose();
    });

    test('commentaire : double soumission, une seule requête', () async {
      final server = ActionsApi();
      final gate = Completer<void>();
      final api = FakeApiClient((call) {
        if (call.method == 'POST') return gate.future;
        return server.call(call);
      });
      final viewModel = AgencyInterventionViewModel(
        AgencyMaintenanceService(api),
        agencyOrgId,
        interventionId,
      );
      await viewModel.load();
      const command = CommentCommand(text: 'Prestataire prévenu.');
      final first = viewModel.comment(command);
      expect(await viewModel.comment(command), isA<WriteIgnored>());
      gate.complete();
      await first;
      expect(api.calls.where((c) => c.method == 'POST'), hasLength(1));
    });

    test('relance : double soumission, une seule requête', () async {
      final p = _unpaidProbe();
      final gate = Completer<void>();
      final api = FakeApiClient((call) {
        if (call.method == 'POST') return gate.future;
        return p.server.call(call);
      });
      final viewModel = UnpaidViewModel(AgencyService(api), agencyOrgId);
      await viewModel.load();
      final item = viewModel.state.dataOrNull!.firstWhere(
        (i) => i.caseId != null,
      );
      final command = ReminderCommand(
        kind: ReminderKind.reminder,
        performedOn: viewModel.today,
      );
      final first = viewModel.remind(item, command);
      expect(await viewModel.remind(item, command), isA<WriteIgnored>());
      gate.complete();
      await first;
      expect(api.calls.where((c) => c.method == 'POST'), hasLength(1));
    });

    test('délai ou 5xx : même clé au nouvel essai', () async {
      final (api, server, viewModel) = await _open();
      server.script[decline] = [
        networkFailure(),
        problem(503, 'unavailable', 'Indisponible.'),
      ];
      expect(await viewModel.decline(note), isA<WriteRefused>());
      expect(await viewModel.decline(note), isA<WriteRefused>());
      expect(await viewModel.decline(note), isA<WriteDone>());
      final keys = _posts(api).map((c) => c.headers!['Idempotency-Key']);
      expect(keys.toSet(), hasLength(1));
    });

    test('commentaire : fiche relue entre deux essais, même clé', () async {
      final (api, server, viewModel) = await _open();
      const path = 'POST /interventions/$interventionId/comments';
      const command = CommentCommand(text: 'Prestataire prévenu.');
      server.script[path] = [networkFailure()];
      expect(await viewModel.comment(command), isA<WriteRefused>());
      final reread = apiObject('agency/intervention_reported');
      (reread['data']! as Map<String, Object?>)['lock_version'] = 9;
      server.detail = reread;
      await viewModel.load();
      expect(await viewModel.comment(command), isA<WriteDone>());
      final keys = _posts(api).map((c) => c.headers!['Idempotency-Key']);
      expect(keys.toSet(), hasLength(1));
    });

    test('refus : fiche relue entre deux essais, nouvelle clé', () async {
      final (api, server, viewModel) = await _open();
      server.script[decline] = [networkFailure()];
      expect(await viewModel.decline(note), isA<WriteRefused>());
      final reread = apiObject('agency/intervention_reported');
      (reread['data']! as Map<String, Object?>)['lock_version'] = 9;
      server.detail = reread;
      await viewModel.load();
      expect(await viewModel.decline(note), isA<WriteDone>());
      final keys = _posts(api)
          .map((c) => c.headers!['Idempotency-Key'])
          .toList();
      expect(keys[0], isNot(keys[1]));
    });

    test('408 et 429 : même clé au nouvel essai', () async {
      final (api, server, viewModel) = await _open();
      server.script[decline] = [
        problem(408, 'timeout', 'Délai dépassé.'),
        problem(429, 'too_many_requests', 'Trop de requêtes.'),
      ];
      await viewModel.decline(note);
      await viewModel.decline(note);
      await viewModel.decline(note);
      final keys = _posts(api).map((c) => c.headers!['Idempotency-Key']);
      expect(keys.toSet(), hasLength(1));
    });

    test('422 : nouvelle clé au nouvel essai', () async {
      final (api, server, viewModel) = await _open();
      server.script[decline] = [
        apiProblem('agency/problem_approval_required', status: 422),
      ];
      await viewModel.decline(note);
      await viewModel.decline(note);
      final keys = _posts(api)
          .map((c) => c.headers!['Idempotency-Key'])
          .toList();
      expect(keys, hasLength(2));
      expect(keys[0], isNot(keys[1]));
    });

    test('403 : nouvelle clé au nouvel essai', () async {
      final (api, server, viewModel) = await _open();
      server.script[decline] = [
        apiProblem('agency/problem_role_forbidden', status: 403),
      ];
      await viewModel.decline(note);
      await viewModel.decline(note);
      final keys = _posts(api)
          .map((c) => c.headers!['Idempotency-Key'])
          .toList();
      expect(keys[0], isNot(keys[1]));
    });

    test('429 : le message annonce l’attente du serveur', () async {
      final (_, server, viewModel) = await _open();
      server.script[decline] = [
        const ApiException(
          statusCode: 429,
          message: 'Trop de requêtes.',
          code: 'too_many_requests',
          retryAfterSeconds: 30,
        ),
      ];
      final result = await viewModel.decline(note);
      expect((result as WriteRefused).message, contains('Réessayez dans 30 s'));
    });

    test('fiche non chargée : aucune écriture', () async {
      final api = FakeApiClient(ActionsApi().call);
      final viewModel = AgencyInterventionViewModel(
        AgencyMaintenanceService(api),
        agencyOrgId,
        interventionId,
      );
      expect(await viewModel.cancel(), isA<WriteIgnored>());
      expect(api.calls, isEmpty);
    });
  });

  group('relance d’impayé', () {
    test('nominal : acte du dossier, date du jour, clé', () async {
      final p = _unpaidProbe();
      await p.viewModel.load();
      final item = p.viewModel.state.dataOrNull!.firstWhere(
        (i) => i.caseId != null,
      );
      final result = await p.viewModel.remind(
        item,
        ReminderCommand(
          kind: ReminderKind.reminder,
          performedOn: p.viewModel.today,
          note: 'Premier rappel par SMS.',
        ),
      );
      expect(result, isA<WriteDone>());
      final post = _posts(p.api).single;
      expect(post.path, '/org/$agencyOrgId/recovery/cases/$caseId/acts');
      expect(post.body, {
        'type': 'reminder',
        'performed_on': '2026-11-21',
        'note': 'Premier rappel par SMS.',
      });
      expect(post.headers!['Idempotency-Key'], matches(_uuid));
    });

    test('sans dossier de recouvrement : aucune requête', () async {
      final p = _unpaidProbe();
      await p.viewModel.load();
      final item = p.viewModel.state.dataOrNull!.firstWhere(
        (i) => i.caseId == null,
      );
      final result = await p.viewModel.remind(
        item,
        ReminderCommand(
          kind: ReminderKind.call,
          performedOn: p.viewModel.today,
        ),
      );
      expect(result, isA<WriteIgnored>());
      expect(_posts(p.api), isEmpty);
    });

    test('422 date postérieure : message du serveur, nouvelle clé', () async {
      final p = _unpaidProbe();
      await p.viewModel.load();
      final item = p.viewModel.state.dataOrNull!.firstWhere(
        (i) => i.caseId != null,
      );
      p.server.script['POST /recovery/cases/$caseId/acts'] = [
        problem(422, 'validation_failed', 'La date ne peut pas être future.'),
      ];
      final command = ReminderCommand(
        kind: ReminderKind.reminder,
        performedOn: p.viewModel.today,
      );
      final result = await p.viewModel.remind(item, command);
      expect(
        (result as WriteRefused).message,
        'La date ne peut pas être future.',
      );
      await p.viewModel.remind(item, command);
      final keys = _posts(p.api)
          .map((c) => c.headers!['Idempotency-Key'])
          .toList();
      expect(keys[0], isNot(keys[1]));
    });

    test('réseau : même clé au nouvel essai', () async {
      final p = _unpaidProbe();
      await p.viewModel.load();
      final item = p.viewModel.state.dataOrNull!.firstWhere(
        (i) => i.caseId != null,
      );
      p.server.script['POST /recovery/cases/$caseId/acts'] = [networkFailure()];
      final command = ReminderCommand(
        kind: ReminderKind.reminder,
        performedOn: p.viewModel.today,
      );
      await p.viewModel.remind(item, command);
      await p.viewModel.remind(item, command);
      final keys = _posts(p.api).map((c) => c.headers!['Idempotency-Key']);
      expect(keys.toSet(), hasLength(1));
    });
  });
}

({ActionsApi server, FakeApiClient api, UnpaidViewModel viewModel})
_unpaidProbe() {
  final server = ActionsApi();
  final page = apiObject('agency/unpaid');
  final first = (page['data']! as List<Object?>).first! as Map<String, Object?>;
  first['case'] = {'id': caseId, 'number': 'REC-2026-0001'};
  server.unpaid = page;
  final api = FakeApiClient(server.call);
  final viewModel = UnpaidViewModel(
    AgencyService(api),
    agencyOrgId,
    clock: () => DateTime(2026, 11, 21, 23, 59),
  );
  return (server: server, api: api, viewModel: viewModel);
}
