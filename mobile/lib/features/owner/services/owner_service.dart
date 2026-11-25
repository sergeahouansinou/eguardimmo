import '../../../core/services/api_client.dart';
import '../../../core/utils/cursor_pages.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/json_reader.dart';
import '../models/owner_access.dart';
import '../models/owner_document.dart';
import '../models/owner_home.dart';
import '../models/owner_payout.dart';
import '../models/owner_statement.dart';
import '../models/owner_unit.dart';

class const OwnerService(final ApiClient _api) {
  Future<List<OwnerAccess>> agencies() async => [
    for (final entry in Json.dataList(
      await _api.get('/owner/agencies'),
      'accès',
    ))
      OwnerAccess.fromJson(Json.object(entry, 'accès')),
  ];

  Future<OwnerHome> home(String agencyId) async => OwnerHome.fromJson(
    Json.data(
      await _api.get('/owner/home', query: {'agency': agencyId}),
      'accueil',
    ),
  );

  Future<PayoutsPage> payouts(String agencyId) async {
    List<UpcomingPayout> upcoming = const [];
    final items = await CursorPages.collect((cursor) async {
      final body = await _api.get(
        '/owner/payouts',
        query: {
          'agency': agencyId,
          'per_page': CursorPages.pageSize,
          'cursor': ?cursor,
        },
      );
      if (cursor == null) {
        upcoming = [
          for (final entry in Json.list(
            Json.object(body, 'reversements')['upcoming'],
            'upcoming',
          ))
            UpcomingPayout.fromJson(Json.object(entry, 'reversement prévu')),
        ];
      }
      return CursorPages.parse(body, 'reversements', OwnerPayout.fromJson);
    });
    return PayoutsPage(items: items, upcoming: upcoming);
  }

  Future<OwnerStatement> statement(
    String agencyId, {
    required DateTime from,
    required DateTime to,
  }) async => OwnerStatement.fromJson(
    Json.data(
      await _api.get(
        '/owner/statement',
        query: {
          'agency': agencyId,
          'from': Formatters.isoDate(from),
          'to': Formatters.isoDate(to),
        },
      ),
      'relevé',
    ),
  );

  Future<List<OwnerUnit>> properties(String agencyId) =>
      _all('/owner/properties', agencyId, OwnerUnit.fromJson);

  Future<List<OwnerDocument>> documents(String agencyId) =>
      _all('/owner/documents', agencyId, OwnerDocument.fromJson);

  Future<List<T>> _all<T>(
    String path,
    String agencyId,
    T Function(Map<String, Object?> entry) read,
  ) => CursorPages.collect(
    (cursor) async => CursorPages.parse(
      await _api.get(
        path,
        query: {
          'agency': agencyId,
          'per_page': CursorPages.pageSize,
          'cursor': ?cursor,
        },
      ),
      path,
      read,
    ),
  );
}
