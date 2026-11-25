import '../../../core/services/api_client.dart';
import '../../../core/utils/cursor_pages.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/json_reader.dart';
import '../models/booking.dart';

class const BookingsService(final ApiClient _api) {
  Future<List<Booking>> list() => CursorPages.collect(
    (cursor) async => CursorPages.parse(
      await _api.get(
        '/marketplace/bookings',
        query: {'per_page': CursorPages.pageSize, 'cursor': ?cursor},
      ),
      '/marketplace/bookings',
      Booking.fromJson,
    ),
  );

  /// Les montants sont recalculés par le serveur. `Idempotency-Key` est
  /// obligatoire : la même clé rejoue la même demande (200 au lieu de 201).
  Future<Booking> create({
    required String listingRef,
    required DateTime checkIn,
    required DateTime checkOut,
    required int guests,
    required String idempotencyKey,
  }) async => Booking.fromJson(
    Json.data(
      await _api.post(
        '/marketplace/bookings',
        headers: {'Idempotency-Key': idempotencyKey},
        body: {
          'listing_ref': listingRef,
          'check_in': Formatters.isoDate(checkIn),
          'check_out': Formatters.isoDate(checkOut),
          'guests': guests,
        },
      ),
      'réservation',
    ),
  );

  /// Renvoie la réservation à jour, `refund` calculé par le serveur selon la
  /// politique d'annulation (aucun mouvement d'argent dans cette tranche).
  Future<Booking> cancel(String bookingId) async => Booking.fromJson(
    Json.data(
      await _api.post('/marketplace/bookings/$bookingId/cancel'),
      'annulation',
    ),
  );
}
