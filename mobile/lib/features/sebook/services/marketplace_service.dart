import 'package:dio/dio.dart';

import '../../../core/services/api_client.dart';
import '../../../core/utils/cursor_pages.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/json_reader.dart';
import '../models/listing.dart';
import '../models/listing_filters.dart';
import '../models/place.dart';
import '../models/quote.dart';

/// `/api/v1/marketplace` : lectures publiques, favoris, demandes de visite,
/// devis et disponibilités.
class const MarketplaceService(final ApiClient _api) {
  static const pageSize = 12;

  Future<List<Place>> places(String query, {CancelToken? cancelToken}) async {
    final body = await _api.get(
      '/marketplace/places',
      query: {'q': query},
      cancelToken: cancelToken,
    );
    return [
      for (final entry in Json.dataList(body, '/marketplace/places'))
        Place.fromJson(Json.object(entry, 'lieu')),
    ];
  }

  Future<ListingPage> listings(
    ListingFilters filters, {
    String? after,
    CancelToken? cancelToken,
  }) async => ListingPage.fromBody(
    await _api.get(
      '/marketplace/listings',
      query: {...filters.toQuery(), 'per_page': pageSize, 'after': ?after},
      cancelToken: cancelToken,
    ),
  );

  Future<ListingDetail> listing(String ref) async => ListingDetail.fromJson(
    Json.data(await _api.get('/marketplace/listings/$ref'), 'annonce'),
  );

  Future<Set<String>> favoriteRefs() async {
    final listings = await CursorPages.collect(
      (cursor) async => CursorPages.parse(
        await _api.get(
          '/marketplace/favorites',
          query: {'per_page': CursorPages.pageSize, 'cursor': ?cursor},
        ),
        '/marketplace/favorites',
        ListingSummary.fromJson,
      ),
    );
    return {for (final listing in listings) listing.ref};
  }

  Future<void> addFavorite(String ref) =>
      _api.put('/marketplace/favorites/$ref');

  Future<void> removeFavorite(String ref) =>
      _api.delete('/marketplace/favorites/$ref');

  Future<void> requestVisit(
    String ref, {
    required String slot,
    required String message,
  }) => _api.post(
    '/marketplace/listings/$ref/visit-requests',
    body: {'requested_slot': slot, if (message.isNotEmpty) 'message': message},
  );

  /// Plages occupées sur [from, to[ (fenêtre de 366 jours au plus).
  Future<List<OccupiedRange>> availability(
    String ref, {
    required DateTime from,
    required DateTime to,
  }) async => [
    for (final entry in Json.dataList(
      await _api.get(
        '/marketplace/listings/$ref/availability',
        query: {'from': Formatters.isoDate(from), 'to': Formatters.isoDate(to)},
      ),
      'disponibilités',
    ))
      OccupiedRange.fromJson(Json.object(entry, 'plage')),
  ];

  Future<Quote> quote(
    String ref, {
    required DateTime checkIn,
    required DateTime checkOut,
    required int guests,
  }) async => Quote.fromJson(
    Json.data(
      await _api.post(
        '/marketplace/listings/$ref/quote',
        authenticated: false,
        body: {
          'check_in': Formatters.isoDate(checkIn),
          'check_out': Formatters.isoDate(checkOut),
          'guests': guests,
        },
      ),
      'devis',
    ),
  );
}
