import 'package:eguardimmo/core/state/load_state.dart';
import 'package:eguardimmo/features/owner/services/owner_service.dart';
import 'package:eguardimmo/features/owner/viewmodels/owner_access_viewmodel.dart';
import 'package:eguardimmo/features/owner/viewmodels/owner_home_viewmodel.dart';
import 'package:eguardimmo/features/owner/viewmodels/owner_lists_viewmodels.dart';
import 'package:eguardimmo/features/owner/viewmodels/owner_statement_viewmodel.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';
import '../../helpers/owner_api.dart';

void main() {
  group('Accès', () {
    test('chargement paresseux, sélection de la première agence', () async {
      final api = FakeApiClient(ownerApi);
      final viewModel = OwnerAccessViewModel(OwnerService(api), userId: 'u1');
      expect(api.calls, isEmpty);

      viewModel.ensureLoaded();
      await pumpEventQueue();
      expect(api.calls.single.path, '/owner/agencies');
      expect(viewModel.selected?.agencyId, ownerAgencyId);

      viewModel.select(viewModel.accesses.last);
      expect(viewModel.selected?.agencyId, otherAgencyId);

      viewModel.ensureLoaded();
      await pumpEventQueue();
      expect(api.calls, hasLength(1));
    });

    test('sans utilisateur : aucune requête', () async {
      final api = FakeApiClient(ownerApi);
      OwnerAccessViewModel(OwnerService(api), userId: null).ensureLoaded();
      await pumpEventQueue();
      expect(api.calls, isEmpty);
    });

    test('refus serveur : Failed avec le message du problème', () async {
      final viewModel = OwnerAccessViewModel(
        OwnerService(
          FakeApiClient(
            (_) => problem(403, 'forbidden', 'Accès refusé à cet espace.'),
          ),
        ),
        userId: 'u1',
      );
      await viewModel.load();
      expect(viewModel.state, isA<Failed<Object?>>());
      expect(
        (viewModel.state as Failed<Object?>).message,
        'Accès refusé à cet espace.',
      );
      expect(viewModel.selected, isNull);
    });
  });

  group('Requêtes', () {
    test(
      'accueil : l’agence est transmise, jamais un identifiant libre',
      () async {
        final api = FakeApiClient(ownerApi);
        final viewModel = OwnerHomeViewModel(OwnerService(api), ownerAgencyId);
        await viewModel.load();
        expect(api.calls.single.path, '/owner/home');
        expect(api.calls.single.query, {'agency': ownerAgencyId});
        expect(viewModel.state.dataOrNull?.units, hasLength(3));
      },
    );

    test('reversements : pagination, agence et reversement prévu', () async {
      final api = FakeApiClient(ownerApi);
      final viewModel = OwnerPayoutsViewModel(OwnerService(api), ownerAgencyId);
      await viewModel.load();
      expect(api.calls.single.query, {
        'agency': ownerAgencyId,
        'per_page': 100,
      });
      final page = viewModel.state.dataOrNull!;
      expect(page.items, hasLength(3));
      expect(page.upcoming, hasLength(1));
    });

    test('biens et documents : agence et pagination', () async {
      final api = FakeApiClient(ownerApi);
      final service = OwnerService(api);
      await OwnerPropertiesViewModel(service, ownerAgencyId).load();
      await OwnerDocumentsViewModel(service, ownerAgencyId).load();
      expect(api.calls.map((c) => c.path), [
        '/owner/properties',
        '/owner/documents',
      ]);
      for (final call in api.calls) {
        expect(call.query, {'agency': ownerAgencyId, 'per_page': 100});
      }
    });

    test('échec réseau : message visible, reprise possible', () async {
      var fail = true;
      final viewModel = OwnerHomeViewModel(
        OwnerService(
          FakeApiClient((call) => fail ? networkFailure() : ownerApi(call)),
        ),
        ownerAgencyId,
      );
      await viewModel.load();
      expect(viewModel.state, isA<Failed<Object?>>());
      fail = false;
      await viewModel.load();
      expect(viewModel.state, isA<Loaded<Object?>>());
    });
  });

  group('Relevé', () {
    test(
      'mois civil complet demandé, navigation bornée au mois courant',
      () async {
        final api = FakeApiClient(ownerApi);
        final viewModel = OwnerStatementViewModel(
          OwnerService(api),
          ownerAgencyId,
          clock: () => DateTime(2026, 11, 21),
        );
        await viewModel.load();
        expect(api.calls.last.query, {
          'agency': ownerAgencyId,
          'from': '2026-11-01',
          'to': '2026-11-30',
        });
        expect(viewModel.canGoNext, isFalse);

        await viewModel.previous();
        expect(api.calls.last.query, {
          'agency': ownerAgencyId,
          'from': '2026-10-01',
          'to': '2026-10-31',
        });
        expect(viewModel.canGoNext, isTrue);

        await viewModel.next();
        expect(api.calls.last.query?['from'], '2026-11-01');
        await viewModel.next();
        expect(api.calls, hasLength(3));
      },
    );

    test('février d’une année bissextile : dernier jour exact', () async {
      final api = FakeApiClient(ownerApi);
      final viewModel = OwnerStatementViewModel(
        OwnerService(api),
        ownerAgencyId,
        clock: () => DateTime(2028, 3, 10),
      );
      await viewModel.previous();
      expect(api.calls.last.query?['to'], '2028-02-29');
    });
  });
}
