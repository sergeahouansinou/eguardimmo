import 'package:eguardimmo/core/state/load_state.dart';
import 'package:eguardimmo/core/utils/cursor_pages.dart';
import 'package:eguardimmo/features/agency/services/agency_service.dart';
import 'package:eguardimmo/features/agency/viewmodels/agency_viewmodels.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/agency_api.dart';
import '../../helpers/api_fixtures.dart';
import '../../helpers/fakes.dart';

void main() {
  test('indicateurs : requête sur le segment d’organisation fourni', () async {
    final api = FakeApiClient(agencyApi);
    final viewModel = AgencyKpisViewModel(AgencyService(api), agencyOrgId);
    await viewModel.load();
    expect(
      api.calls.single.path,
      '/org/$agencyOrgId/reporting/home/agency-kpis',
    );
    expect(viewModel.state.dataOrNull?.collectionRateText, '97,1 %');
  });

  test(
    'segment d’organisation invalide : aucune requête, échec visible',
    () async {
      final api = FakeApiClient(agencyApi);
      final viewModel = AgencyKpisViewModel(AgencyService(api), '../admin');
      await viewModel.load();
      expect(api.calls, isEmpty);
      expect(viewModel.state, isA<Failed<Object?>>());
    },
  );

  test(
    'impayés : paginés par next_after, triés par retard décroissant',
    () async {
      final pages = <String?>[];
      final first = apiObject('agency/unpaid');
      final second = apiObject('agency/unpaid');
      (first['meta']! as Map<String, Object?>)['next_after'] = 'cursor-1';
      final api = FakeApiClient((call) {
        pages.add(call.query?['after'] as String?);
        return call.query?['after'] == null ? first : second;
      });
      final viewModel = UnpaidViewModel(AgencyService(api), agencyOrgId);
      await viewModel.load();
      expect(pages, [null, 'cursor-1']);
      expect(api.calls.first.query, {'per_page': 100});
      final items = viewModel.state.dataOrNull!;
      expect(items, hasLength(6));
      expect(items.map((i) => i.daysOverdue), [72, 72, 42, 42, 11, 11]);
    },
  );

  test('impayés : curseur restant après la dernière page autorisée, échec '
      'visible plutôt qu’une liste tronquée', () async {
    final page = apiObject('agency/unpaid');
    (page['meta']! as Map<String, Object?>)['next_after'] = 'cursor-sans-fin';
    final api = FakeApiClient((_) => page);
    final viewModel = UnpaidViewModel(AgencyService(api), agencyOrgId);
    await viewModel.load();
    expect(api.calls, hasLength(CursorPages.maxPages));
    expect(viewModel.state, isA<Failed<Object?>>());
    expect(viewModel.state.dataOrNull, isNull);
  });

  test(
    'interventions : filtre transmis au serveur, jamais appliqué en local',
    () async {
      final api = FakeApiClient(agencyApi);
      final viewModel = AgencyInterventionsViewModel(
        AgencyService(api),
        agencyOrgId,
      );
      await viewModel.load();
      expect(api.calls.last.query, {'per_page': 100});

      await viewModel.select(InterventionFilter.toApprove);
      expect(api.calls.last.query, {
        'status': 'awaiting_approval',
        'per_page': 100,
      });
      expect(viewModel.filter, InterventionFilter.toApprove);

      await viewModel.select(InterventionFilter.all);
      expect(api.calls.last.query, {'per_page': 100});
    },
  );

  test(
    'changement de filtre : la réponse tardive de l’ancien filtre est ignorée',
    () async {
      final api = FakeApiClient(agencyApi);
      final viewModel = AgencyInterventionsViewModel(
        AgencyService(api),
        agencyOrgId,
      );
      final stale = viewModel.load();
      final fresh = viewModel.select(InterventionFilter.inProgress);
      await Future.wait([stale, fresh]);
      expect(api.calls, hasLength(2));
      expect(viewModel.state, isA<Loaded<Object?>>());
      expect(viewModel.filter, InterventionFilter.inProgress);
    },
  );

  test('baux : phase en cours par défaut, filtre côté serveur', () async {
    final api = FakeApiClient(agencyApi);
    final viewModel = AgencyLeasesViewModel(AgencyService(api), agencyOrgId);
    await viewModel.load();
    expect(api.calls.last.query?['phase'], 'running');
    await viewModel.select(LeaseFilter.ended);
    expect(api.calls.last.query?['phase'], 'ended');
  });

  test(
    'accès refusé (403) : message du serveur, pas de valeur par défaut',
    () async {
      final viewModel = AgencyAlertsViewModel(
        AgencyService(
          FakeApiClient(
            (_) => problem(
              403,
              'forbidden',
              'Votre rôle ne permet pas cette consultation.',
            ),
          ),
        ),
        agencyOrgId,
      );
      await viewModel.load();
      final state = viewModel.state as Failed<Object?>;
      expect(state.message, 'Votre rôle ne permet pas cette consultation.');
      expect(viewModel.state.dataOrNull, isNull);
    },
  );
}
