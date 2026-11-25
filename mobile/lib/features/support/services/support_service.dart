import 'dart:typed_data';

import '../../../core/services/api_client.dart';
import '../../../core/state/list_page.dart';
import '../../../core/utils/json_reader.dart';
import '../../../core/utils/path_ids.dart';
import '../models/support_availability.dart';
import '../models/support_enums.dart';
import '../models/ticket.dart';
import '../models/ticket_message.dart';

class const SupportService(final ApiClient _api) {
  static const pageSize = 50;
  static const messagesPageSize = 50;

  Future<SupportAvailability> status() async => SupportAvailability.fromJson(
    Json.data(await _api.get('/support/status'), '/support/status'),
  );

  /// `GET /support/tickets` : `{data, links, meta: {next_cursor, …}}`.
  Future<ListPage<TicketSummary>> tickets({String? cursor}) async {
    final body = await _api.get(
      '/support/tickets',
      query: {'per_page': pageSize, 'cursor': ?cursor},
    );
    final root = Json.object(body, '/support/tickets');
    return ListPage<TicketSummary>(
      items: [
        for (final entry in Json.dataList(root, '/support/tickets'))
          TicketSummary.fromJson(Json.object(entry, 'demande')),
      ],
      nextCursor: Json.stringOrNull(Json.child(root, 'meta'), 'next_cursor'),
    );
  }

  Future<TicketDetail> ticket(String id) async => TicketDetail.fromJson(
    Json.data(
      await _api.get('/support/tickets/${PathIds.segment(id)}'),
      'demande',
    ),
  );

  /// Messages reçus après `after` (404 `message_not_found` si le repère est
  /// inconnu), plus l'état de la demande.
  Future<TicketMessagesPage> messages(
    String id, {
    required String after,
  }) async {
    final root = Json.object(
      await _api.get(
        '/support/tickets/${PathIds.segment(id)}/messages',
        query: {'per_page': messagesPageSize, 'after': after},
      ),
      'messages',
    );
    final meta = Json.child(root, 'meta');
    return TicketMessagesPage(
      items: [
        for (final entry in Json.dataList(root, 'messages'))
          TicketMessage.fromJson(Json.object(entry, 'message')),
      ],
      hasMore: Json.boolean(meta, 'has_more'),
      status: TicketStatus.parse(Json.string(meta, 'status')),
      requesterLastReadAt: Json.dateOrNull(meta, 'requester_last_read_at'),
    );
  }

  /// `space` et `organization_id` sont vérifiés par le serveur ; `client_id`
  /// rejoue la même ouverture (200 au lieu de 201) sans doubler la demande.
  Future<TicketDetail> open({
    required String space,
    required String? organizationId,
    required TicketCategory category,
    required String subject,
    required String body,
    required String clientId,
  }) async => TicketDetail.fromJson(
    Json.data(
      await _api.post(
        '/support/tickets',
        body: {
          'space': space,
          'organization_id': ?organizationId,
          'category': category.wire,
          'subject': subject,
          'body': body,
          'client_id': clientId,
        },
      ),
      'demande',
    ),
  );

  Future<TicketDetail> reply(
    String id, {
    required String body,
    required String clientId,
  }) async => TicketDetail.fromJson(
    Json.data(
      await _api.post(
        '/support/tickets/${PathIds.segment(id)}/messages',
        body: {'body': body, 'client_id': clientId},
      ),
      'demande',
    ),
  );

  Future<TicketDetail> markRead(String id) async => TicketDetail.fromJson(
    Json.data(
      await _api.patch(
        '/support/tickets/${PathIds.segment(id)}',
        body: {'read': true},
      ),
      'demande',
    ),
  );

  Future<Uint8List> downloadAttachment(TicketAttachment attachment) =>
      _api.download('/support/attachments/${PathIds.segment(attachment.id)}');
}
