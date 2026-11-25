import 'dart:async';

import 'package:eguardimmo/core/models/money.dart';
import 'package:eguardimmo/core/state/load_state.dart';
import 'package:eguardimmo/features/tenant/models/tenant_intervention.dart';
import 'package:eguardimmo/features/tenant/services/tenant_leases_service.dart';
import 'package:eguardimmo/features/tenant/services/tenant_maintenance_service.dart';
import 'package:eguardimmo/features/tenant/services/tenant_rent_service.dart';
import 'package:eguardimmo/features/tenant/viewmodels/installments_viewmodel.dart';
import 'package:eguardimmo/features/tenant/viewmodels/new_request_viewmodel.dart';
import 'package:eguardimmo/features/tenant/viewmodels/rent_history_viewmodels.dart';
import 'package:eguardimmo/features/tenant/viewmodels/requests_viewmodel.dart';
import 'package:eguardimmo/features/tenant/viewmodels/tenant_leases_viewmodels.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/api_fixtures.dart';
import '../../helpers/fakes.dart';
import '../../helpers/tenant_api.dart';

void main() {
  group('Échéances', () {
    test(
      'requête paginée, prochaine échéance et reste dû du serveur',
      () async {
        final api = FakeApiClient(tenantApi);
        final viewModel = InstallmentsViewModel(TenantRentService(api));
        await viewModel.load();

        expect(api.calls.single.path, '/tenant/rent/installments');
        expect(api.calls.single.query, {'per_page': 100});
        expect(viewModel.next?.dueDate, DateTime(2026, 11, 5));
        expect(viewModel.overdueCount, 1);
        expect(viewModel.balance.outstanding, [const Money(65000, 'EUR')]);
        expect(viewModel.balance.incomplete, isFalse);
      },
    );

    test('reste inconnu : total présenté comme incomplet', () async {
      final json = apiObject('tenant/installments');
      final first =
          (json['data']! as List<Object?>).first! as Map<String, Object?>;
      first['outstanding'] = null;
      final viewModel = InstallmentsViewModel(
        TenantRentService(FakeApiClient((_) => json)),
      );
      await viewModel.load();
      expect(viewModel.balance.incomplete, isTrue);
      expect(viewModel.balance.outstanding, [const Money(65000, 'EUR')]);
    });

    test('tout payé : aucune échéance à régler', () async {
      final viewModel = InstallmentsViewModel(
        TenantRentService(
          FakeApiClient((_) => apiFixture('tenant/installments_paid')),
        ),
      );
      await viewModel.load();
      expect(viewModel.next, isNull);
      expect(viewModel.balance.outstanding, isEmpty);
    });

    test('échec réseau : état Failed avec message, reprise possible', () async {
      var fail = true;
      final viewModel = InstallmentsViewModel(
        TenantRentService(
          FakeApiClient(
            (call) =>
                fail ? networkFailure() : apiFixture('tenant/installments'),
          ),
        ),
      );
      await viewModel.load();
      expect(viewModel.state, isA<Failed<Object?>>());
      fail = false;
      await viewModel.load();
      expect(viewModel.state, isA<Loaded<Object?>>());
    });
  });

  test('paiements triés du plus récent, quittances chargées', () async {
    final api = FakeApiClient(tenantApi);
    final payments = PaymentsViewModel(TenantRentService(api));
    final receipts = ReceiptsViewModel(TenantRentService(api));
    await payments.load();
    await receipts.load();
    expect(payments.state.dataOrNull, hasLength(2));
    expect(receipts.state.dataOrNull!.single.number, 'QT-2026-0001');
  });

  test('documents : un appel par bail, groupés par référence', () async {
    final api = FakeApiClient(tenantApi);
    final viewModel = TenantDocumentsViewModel(TenantLeasesService(api));
    await viewModel.load();
    final groups = viewModel.state.dataOrNull!;
    expect(groups.single.leaseReference, 'BL-2026-76772');
    expect(groups.single.documents, hasLength(2));
    expect(api.calls.map((c) => c.path), [
      '/tenant/leases',
      '/tenant/leases/$tenantLeaseId/documents',
    ]);
  });

  test('bail courant : le bail en cours', () async {
    final viewModel = TenantLeasesViewModel(
      TenantLeasesService(FakeApiClient(tenantApi)),
    );
    await viewModel.load();
    expect(viewModel.current?.reference, 'BL-2026-76772');
  });

  group('Demandes', () {
    test('commentaire : texte nettoyé, vue remplacée par la réponse', () async {
      final api = FakeApiClient(tenantApi);
      final viewModel = RequestDetailViewModel(
        TenantMaintenanceService(api),
        requestId,
      );
      await viewModel.load();
      final error = await viewModel.comment('  Merci de passer vite.  ');
      expect(error, isNull);
      final post = api.calls.last;
      expect(post.path, '/tenant/interventions/$requestId/comments');
      expect(post.body, {'text': 'Merci de passer vite.'});
      expect(viewModel.state.dataOrNull?.events, hasLength(3));
    });

    group('commentaire : clé d’idempotence', () {
      Future<RequestDetailViewModel> detail(FakeApiClient api) async {
        final viewModel = RequestDetailViewModel(
          TenantMaintenanceService(api),
          requestId,
        );
        await viewModel.load();
        return viewModel;
      }

      List<String?> keys(FakeApiClient api) => api.calls
          .where((c) => c.method == 'POST')
          .map((c) => c.headers?['Idempotency-Key'])
          .toList();

      test('envoyée avec chaque commentaire', () async {
        final api = FakeApiClient(tenantApi);
        final viewModel = await detail(api);
        await viewModel.comment('Bonjour');
        expect(keys(api).single, hasLength(36));
      });

      test('coupure réseau : même clé au nouvel essai du même texte', () async {
        var failing = true;
        final api = FakeApiClient(
          (call) => call.method == 'POST' && failing
              ? networkFailure()
              : tenantApi(call),
        );
        final viewModel = await detail(api);
        await viewModel.comment('Bonjour');
        failing = false;
        await viewModel.comment('Bonjour');
        expect(keys(api), hasLength(2));
        expect(keys(api).first, keys(api).last);
      });

      test('panne serveur 500 : même clé au nouvel essai', () async {
        var failing = true;
        final api = FakeApiClient(
          (call) => call.method == 'POST' && failing
              ? problem(500, 'server_error', 'Panne')
              : tenantApi(call),
        );
        final viewModel = await detail(api);
        await viewModel.comment('Bonjour');
        failing = false;
        await viewModel.comment('Bonjour');
        expect(keys(api).first, keys(api).last);
      });

      test('texte modifié après un échec : nouvelle clé', () async {
        var failing = true;
        final api = FakeApiClient(
          (call) => call.method == 'POST' && failing
              ? networkFailure()
              : tenantApi(call),
        );
        final viewModel = await detail(api);
        await viewModel.comment('Bonjour');
        failing = false;
        await viewModel.comment('Bonjour à tous');
        expect(keys(api).first, isNot(keys(api).last));
      });

      test('refus 422 : nouvelle clé au prochain envoi', () async {
        var failing = true;
        final api = FakeApiClient(
          (call) => call.method == 'POST' && failing
              ? problem(422, 'invalid', 'Refusé')
              : tenantApi(call),
        );
        final viewModel = await detail(api);
        await viewModel.comment('Bonjour');
        failing = false;
        await viewModel.comment('Bonjour');
        expect(keys(api).first, isNot(keys(api).last));
      });

      test('succès : le commentaire suivant a sa propre clé', () async {
        final api = FakeApiClient(tenantApi);
        final viewModel = await detail(api);
        await viewModel.comment('Bonjour');
        await viewModel.comment('Bonjour');
        expect(keys(api).first, isNot(keys(api).last));
      });
    });

    test(
      'annulation pendant un rechargement : la réponse tardive du chargement '
      'ne remplace pas la vue renvoyée par le serveur',
      () async {
        final slow = Completer<Object?>();
        var gets = 0;
        final api = FakeApiClient((call) {
          if (call.method != 'GET') return tenantApi(call);
          gets++;
          return gets == 1 ? tenantApi(call) : slow.future;
        });
        final viewModel = RequestDetailViewModel(
          TenantMaintenanceService(api),
          requestId,
        );
        await viewModel.load();
        final reloading = viewModel.load();
        expect(await viewModel.cancel(), isNull);
        slow.complete(
          tenantApi(const RecordedCall('GET', '/tenant/interventions/x')),
        );
        await reloading;
        expect(viewModel.state.dataOrNull?.state, RequestState.cancelled);
      },
    );

    test('annulation : l’état affiché est celui du serveur', () async {
      final api = FakeApiClient(tenantApi);
      final viewModel = RequestDetailViewModel(
        TenantMaintenanceService(api),
        requestId,
      );
      await viewModel.load();
      expect(await viewModel.cancel(), isNull);
      expect(viewModel.state.dataOrNull?.state, RequestState.cancelled);
      expect(viewModel.state.dataOrNull?.cancellable, isFalse);
    });

    test('annulation refusée : message du serveur, vue inchangée', () async {
      final api = FakeApiClient(
        (call) => call.method == 'POST'
            ? problem(409, 'transition_invalid', 'Action impossible.')
            : tenantApi(call),
      );
      final viewModel = RequestDetailViewModel(
        TenantMaintenanceService(api),
        requestId,
      );
      await viewModel.load();
      expect(await viewModel.cancel(), 'Action impossible.');
      expect(viewModel.state.dataOrNull?.state, RequestState.reported);
    });
  });

  group('Signalement', () {
    Future<NewRequestViewModel> ready(FakeApiClient api) async {
      final viewModel = NewRequestViewModel(TenantMaintenanceService(api));
      await viewModel.load();
      viewModel.selectNature(viewModel.option!.natures.first);
      return viewModel;
    }

    test('envoi : corps validé par le serveur, clé d’idempotence', () async {
      final api = FakeApiClient(tenantApi);
      final viewModel = await ready(api);
      viewModel
        ..selectUnit(viewModel.option!.units.first)
        ..selectUrgency(Urgency.soon);
      final created = await viewModel.submit(
        title: ' Fuite sous l’évier ',
        description: 'De l’eau coule.',
        room: '',
        availability: '',
      );
      expect(created?.reference, 'INT-2026-0001');
      final post = api.calls.last;
      expect(post.path, '/tenant/interventions');
      expect(post.body, {
        'lease_id': tenantLeaseId,
        'nature_term_id': viewModel.nature!.id,
        'title': 'Fuite sous l’évier',
        'description': 'De l’eau coule.',
        'unit_id': viewModel.unit!.id,
        'reported_urgency': 'soon',
      });
      expect(post.body.toString(), isNot(contains('organization')));
      expect(post.headers?['Idempotency-Key'], hasLength(36));
    });

    test(
      'coupure réseau : même clé au nouvel essai (pas de doublon)',
      () async {
        var fail = true;
        final api = FakeApiClient(
          (call) => call.method == 'POST' && fail
              ? networkFailure()
              : tenantApi(call),
        );
        final viewModel = await ready(api);
        expect(
          await viewModel.submit(
            title: 'abc',
            description: 'd',
            room: '',
            availability: '',
          ),
          isNull,
        );
        expect(viewModel.error, contains('Connexion impossible'));
        fail = false;
        await viewModel.submit(
          title: 'abc',
          description: 'd',
          room: '',
          availability: '',
        );
        final keys = api.calls
            .where((c) => c.method == 'POST')
            .map((c) => c.headers!['Idempotency-Key'])
            .toList();
        expect(keys, hasLength(2));
        expect(keys.first, keys.last);
      },
    );

    test(
      'refus 422 : erreurs par champ, nouvelle clé au prochain envoi',
      () async {
        final api = FakeApiClient(
          (call) => call.method == 'POST'
              ? apiProblem('tenant/problem_report_invalid', status: 422)
              : tenantApi(call),
        );
        final viewModel = await ready(api);
        await viewModel.submit(
          title: 'a',
          description: '',
          room: '',
          availability: '',
        );
        expect(
          viewModel.fieldError('title'),
          contains('au moins 3 caractères'),
        );
        await viewModel.submit(
          title: 'abc',
          description: 'd',
          room: '',
          availability: '',
        );
        final keys = api.calls
            .where((c) => c.method == 'POST')
            .map((c) => c.headers!['Idempotency-Key'])
            .toList();
        expect(keys.first, isNot(keys.last));
      },
    );

    for (final status in [500, 502, 408, 429]) {
      test(
        'réponse $status : même clé au nouvel essai (pas de doublon)',
        () async {
          var failing = true;
          final api = FakeApiClient(
            (call) => call.method == 'POST' && failing
                ? problem(status, 'transitoire', 'Réessayez')
                : tenantApi(call),
          );
          final viewModel = await ready(api);
          await viewModel.submit(
            title: 'abc',
            description: 'd',
            room: '',
            availability: '',
          );
          failing = false;
          await viewModel.submit(
            title: 'abc',
            description: 'd',
            room: '',
            availability: '',
          );
          final keys = api.calls
              .where((c) => c.method == 'POST')
              .map((c) => c.headers!['Idempotency-Key'])
              .toList();
          expect(keys.first, keys.last);
        },
      );
    }

    test('refus 403 : nouvelle clé au prochain envoi', () async {
      var failing = true;
      final api = FakeApiClient(
        (call) => call.method == 'POST' && failing
            ? problem(403, 'forbidden', 'Refusé')
            : tenantApi(call),
      );
      final viewModel = await ready(api);
      await viewModel.submit(
        title: 'abc',
        description: 'd',
        room: '',
        availability: '',
      );
      failing = false;
      await viewModel.submit(
        title: 'abc',
        description: 'd',
        room: '',
        availability: '',
      );
      final keys = api.calls
          .where((c) => c.method == 'POST')
          .map((c) => c.headers!['Idempotency-Key'])
          .toList();
      expect(keys.first, isNot(keys.last));
    });

    test('trop de demandes ouvertes : message du serveur affiché', () async {
      final api = FakeApiClient(
        (call) => call.method == 'POST'
            ? apiProblem('tenant/problem_too_many_open', status: 422)
            : tenantApi(call),
      );
      final viewModel = await ready(api);
      await viewModel.submit(
        title: 'abc',
        description: 'd',
        room: '',
        availability: '',
      );
      expect(viewModel.error, 'Trop de demandes ouvertes sur ce bail.');
    });
  });

  test('liste des demandes : requête paginée', () async {
    final api = FakeApiClient(tenantApi);
    final viewModel = RequestsViewModel(TenantMaintenanceService(api));
    await viewModel.load();
    expect(api.calls.single.path, '/tenant/interventions');
    expect(viewModel.state.dataOrNull, hasLength(4));
  });
}
