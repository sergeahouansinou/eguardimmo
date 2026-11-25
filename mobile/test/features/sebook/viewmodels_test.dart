import 'package:eguardimmo/core/state/load_state.dart';
import 'package:eguardimmo/features/sebook/models/listing.dart';
import 'package:eguardimmo/features/sebook/models/listing_enums.dart';
import 'package:eguardimmo/features/sebook/models/place.dart';
import 'package:eguardimmo/features/sebook/services/marketplace_service.dart';
import 'package:eguardimmo/features/sebook/viewmodels/explore_viewmodel.dart';
import 'package:eguardimmo/features/sebook/viewmodels/favorites_viewmodel.dart';
import 'package:eguardimmo/features/sebook/viewmodels/listing_detail_viewmodel.dart';
import 'package:eguardimmo/features/sebook/viewmodels/place_search_viewmodel.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';
import '../../helpers/fixtures.dart';

void main() {
  group('Explorer', () {
    test(
      'première page filtrée sur les séjours courts, curseur conservé',
      () async {
        final api = FakeApiClient(
          (_) => Fixtures.listingsPage([Fixtures.listing()], next: 'curseur-1'),
        );
        final viewModel = ExploreViewModel(MarketplaceService(api));
        await viewModel.load();

        final page = viewModel.state.dataOrNull!;
        expect(page.items, hasLength(1));
        expect(page.hasMore, isTrue);
        expect(api.calls.single.path, '/marketplace/listings');
        expect(api.calls.single.query, {'kind': 'short_stay', 'per_page': 12});
      },
    );

    test('filtre de catégorie et de lieu transmis au serveur', () async {
      final api = FakeApiClient((_) => Fixtures.listingsPage([]));
      final viewModel = ExploreViewModel(MarketplaceService(api));
      await viewModel.selectPlace(Place.fromJson(Fixtures.place()));
      await viewModel.selectCategory(ListingCategory.studio);
      expect(api.calls.last.query, {
        'kind': 'short_stay',
        'place': 'lyon',
        'category': 'studio',
        'per_page': 12,
      });
    });

    test('page suivante ajoutée avec le curseur `after`', () async {
      final api = FakeApiClient((call) {
        return call.query!['after'] == 'curseur-1'
            ? Fixtures.listingsPage([
                Fixtures.listing(ref: Fixtures.otherListingRef),
              ])
            : Fixtures.listingsPage([Fixtures.listing()], next: 'curseur-1');
      });
      final viewModel = ExploreViewModel(MarketplaceService(api));
      await viewModel.load();
      await viewModel.loadMore();

      final page = viewModel.state.dataOrNull!;
      expect(page.items.map((l) => l.ref), [
        Fixtures.listingRef,
        Fixtures.otherListingRef,
      ]);
      expect(page.hasMore, isFalse);
    });

    test(
      'échec de la page suivante : message conservé, liste intacte',
      () async {
        var fail = false;
        final api = FakeApiClient(
          (_) => fail
              ? networkFailure()
              : Fixtures.listingsPage([Fixtures.listing()], next: 'c'),
        );
        final viewModel = ExploreViewModel(MarketplaceService(api));
        await viewModel.load();
        fail = true;
        await viewModel.loadMore();

        final page = viewModel.state.dataOrNull!;
        expect(page.items, hasLength(1));
        expect(page.moreFailure, contains('Connexion impossible'));
        expect(page.hasMore, isTrue);
      },
    );

    test('échec du chargement initial : état Failed', () async {
      final viewModel = ExploreViewModel(
        MarketplaceService(FakeApiClient((_) => networkFailure())),
      );
      await viewModel.load();
      expect(viewModel.state, isA<Failed<ListingPage>>());
    });
  });

  group('Fiche annonce', () {
    test('lecture par référence opaque', () async {
      final api = FakeApiClient((_) => {'data': Fixtures.listingDetail()});
      final viewModel = ListingDetailViewModel(
        MarketplaceService(api),
        'k3m7q9x2v8nb',
      );
      await viewModel.load();
      expect(api.calls.single.path, '/marketplace/listings/k3m7q9x2v8nb');
      expect(viewModel.state.dataOrNull!.deposit?.minor, 30000);
    });

    test('annonce introuvable (404) : message du serveur', () async {
      final api = FakeApiClient(
        (_) => problem(404, 'listing_not_found', 'Annonce introuvable.'),
      );
      final viewModel = ListingDetailViewModel(
        MarketplaceService(api),
        'k3m7q9x2v8nb',
      );
      await viewModel.load();
      expect(
        viewModel.state,
        isA<Failed<ListingDetail>>().having(
          (s) => s.message,
          'message',
          'Annonce introuvable.',
        ),
      );
    });
  });

  group('Favoris', () {
    FavoritesViewModel build(FakeApiClient api) =>
        FavoritesViewModel(MarketplaceService(api));

    test('chargement : références lues dans /marketplace/favorites', () async {
      final api = FakeApiClient((_) => Fixtures.page([Fixtures.listing()]));
      final viewModel = build(api);
      await viewModel.load();
      expect(viewModel.isFavorite('k3m7q9x2v8nb'), isTrue);
      expect(viewModel.isFavorite('autre'), isFalse);
    });

    test('chargement paginé : tous les curseurs sont suivis', () async {
      final api = FakeApiClient(
        (call) => call.query!['cursor'] == 'curseur-2'
            ? Fixtures.page([Fixtures.listing(ref: Fixtures.otherListingRef)])
            : Fixtures.page([Fixtures.listing()], next: 'curseur-2'),
      );
      final viewModel = build(api);
      await viewModel.load();
      expect(viewModel.isFavorite(Fixtures.listingRef), isTrue);
      expect(viewModel.isFavorite(Fixtures.otherListingRef), isTrue);
      expect(api.calls.first.query, {'per_page': 100});
      expect(api.calls.last.query, {'per_page': 100, 'cursor': 'curseur-2'});
    });

    test('ajout : PUT puis état à jour', () async {
      final api = FakeApiClient(
        (call) => call.method == 'GET' ? Fixtures.page([]) : null,
      );
      final viewModel = build(api);
      await viewModel.load();
      expect(await viewModel.toggle('k3m7q9x2v8nb'), isNull);
      expect(viewModel.isFavorite('k3m7q9x2v8nb'), isTrue);
      expect(api.calls.last.method, 'PUT');
      expect(api.calls.last.path, '/marketplace/favorites/k3m7q9x2v8nb');
    });

    test('retrait : DELETE', () async {
      final api = FakeApiClient(
        (call) =>
            call.method == 'GET' ? Fixtures.page([Fixtures.listing()]) : null,
      );
      final viewModel = build(api);
      await viewModel.load();
      expect(await viewModel.toggle('k3m7q9x2v8nb'), isNull);
      expect(viewModel.isFavorite('k3m7q9x2v8nb'), isFalse);
      expect(api.calls.last.method, 'DELETE');
    });

    test('échec serveur : l’état est rétabli et le message remonté', () async {
      final api = FakeApiClient(
        (call) => call.method == 'GET'
            ? Fixtures.page([])
            : problem(
                403,
                'email_unverified',
                'Confirmez votre adresse e-mail pour accéder à cet espace.',
              ),
      );
      final viewModel = build(api);
      await viewModel.load();
      final failure = await viewModel.toggle('k3m7q9x2v8nb');
      expect(failure, contains('Confirmez votre adresse e-mail'));
      expect(viewModel.isFavorite('k3m7q9x2v8nb'), isFalse);
    });

    test('favoris non chargés : message, aucun appel d’écriture', () async {
      final api = FakeApiClient((_) => null);
      final viewModel = build(api);
      expect(await viewModel.toggle('x'), isNotNull);
      expect(api.calls, isEmpty);
    });
  });

  group('Recherche de lieux', () {
    PlaceSearchViewModel build(FakeApiClient api) =>
        PlaceSearchViewModel(MarketplaceService(api), debounce: Duration.zero);

    test('moins de 2 caractères : aucun appel', () async {
      final api = FakeApiClient((_) => Fixtures.places([]));
      final viewModel = build(api)..onChanged('L');
      await Future<void>.delayed(const Duration(milliseconds: 5));
      expect(api.calls, isEmpty);
      expect(viewModel.status, PlaceSearchStatus.idle);
    });

    test('résultats : lieux lus, paramètre q transmis', () async {
      final api = FakeApiClient((_) => Fixtures.places([Fixtures.place()]));
      final viewModel = build(api)..onChanged('Ly');
      await Future<void>.delayed(const Duration(milliseconds: 5));
      expect(viewModel.status, PlaceSearchStatus.results);
      expect(viewModel.places.single.slug, 'lyon');
      expect(api.calls.single.query, {'q': 'Ly'});
    });

    test('échec : état failed avec message', () async {
      final api = FakeApiClient((_) => networkFailure());
      final viewModel = build(api)..onChanged('Ly');
      await Future<void>.delayed(const Duration(milliseconds: 5));
      expect(viewModel.status, PlaceSearchStatus.failed);
      expect(viewModel.failure, contains('Connexion impossible'));
    });
  });
}
