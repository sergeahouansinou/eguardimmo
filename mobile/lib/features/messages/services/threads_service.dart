import 'dart:typed_data';

import '../../../core/services/api_client.dart';
import '../../../core/state/list_page.dart';
import '../../../core/utils/json_reader.dart';
import '../models/compose_option.dart';
import '../models/messaging_scope.dart';
import '../models/thread.dart';
import '../models/thread_message.dart';

enum ThreadFilter() {
  all,
  unread,
}

class const ThreadsService(final ApiClient _api) {
  static const listPageSize = 25;
  static const messagesPageSize = 50;

  /// `GET …/conversations` : `{data: [fil], meta: {has_more, next_cursor}}`.
  /// Booléens en `1` : la règle `boolean` du serveur refuse « true ».
  Future<ListPage<ThreadSummary>> list(
    ThreadsEndpoint endpoint, {
    ThreadFilter filter = ThreadFilter.all,
    String? cursor,
  }) async {
    final scope = endpoint.scope;
    final body = await _api.get(
      endpoint.conversations,
      query: {
        'per_page': listPageSize,
        'cursor': ?cursor,
        if (scope.isStaff) 'kind': ?endpoint.kind?.wire,
        if (scope.isStaff && filter == ThreadFilter.unread) 'tab': 'unread',
        if (!scope.isStaff && filter == ThreadFilter.unread) 'unread': '1',
      },
    );
    final root = Json.object(body, endpoint.conversations);
    return ListPage<ThreadSummary>(
      items: [
        for (final entry in Json.dataList(root, endpoint.conversations))
          _summary(scope, Json.object(entry, 'conversation')),
      ],
      nextCursor: Json.stringOrNull(Json.child(root, 'meta'), 'next_cursor'),
    );
  }

  Future<ThreadDetail> show(ThreadsEndpoint endpoint, String id) async =>
      _detail(
        endpoint.scope,
        Json.data(await _api.get(endpoint.conversation(id)), 'conversation'),
      );

  /// Sans `after` : les messages les plus récents, `next_cursor` remonte
  /// l'historique. Avec `after` : ceux qui suivent ce message (404
  /// `message_not_found` si le repère est inconnu).
  Future<MessagesPage> messages(
    ThreadsEndpoint endpoint,
    String id, {
    String? after,
    String? cursor,
  }) async {
    final scope = endpoint.scope;
    final root = Json.object(
      await _api.get(
        endpoint.messages(id),
        query: {
          'per_page': messagesPageSize,
          'after': ?after,
          'cursor': ?cursor,
        },
      ),
      endpoint.messages(id),
    );
    final meta = Json.child(root, 'meta');
    return MessagesPage(
      items: [
        for (final entry in Json.dataList(root, 'messages'))
          _message(scope, Json.object(entry, 'message')),
      ],
      hasMore: Json.boolean(meta, 'has_more'),
      nextCursor: Json.stringOrNull(meta, 'next_cursor'),
      status: ThreadStatus.parse(Json.string(meta, 'status')),
      counterpartReadAt: Json.dateOrNull(
        meta,
        scope.isStaff ? 'counterpart_last_read_at' : 'agency_last_read_at',
      ),
      canReply: scope.isStaff ? null : Json.boolean(meta, 'can_reply'),
    );
  }

  /// `client_id` rejoue le même envoi (200 au lieu de 201) sans le doubler.
  Future<ThreadMessage> post(
    ThreadsEndpoint endpoint,
    String id, {
    required String body,
    required String clientId,
  }) async => _message(
    endpoint.scope,
    Json.data(
      await _api.post(
        endpoint.messages(id),
        body: {'body': body, 'client_id': clientId},
      ),
      'message',
    ),
  );

  Future<void> markRead(ThreadsEndpoint endpoint, String id) async {
    await _api.patch(endpoint.conversation(id), body: {'read': true});
  }

  Future<ThreadSummary> setStatus(
    ThreadsEndpoint endpoint,
    String id,
    ThreadStatus status,
  ) async => _detail(
    endpoint.scope,
    Json.data(
      await _api.patch(
        endpoint.conversation(id),
        body: {'status': status.wire},
      ),
      'conversation',
    ),
  ).summary;

  Future<List<ComposeOption>> options(ThreadsEndpoint endpoint) async => [
    for (final entry in Json.dataList(
      await _api.get(endpoint.options),
      endpoint.options,
    ))
      ComposeOption.fromJson(Json.object(entry, 'option')),
  ];

  Future<ThreadDetail> open(
    ThreadsEndpoint endpoint, {
    required String leaseId,
    required String subject,
    required String body,
    required String clientId,
  }) async => _detail(
    endpoint.scope,
    Json.data(
      await _api.post(
        endpoint.conversations,
        body: {
          'lease_id': leaseId,
          'subject': subject,
          'body': body,
          'client_id': clientId,
        },
      ),
      'conversation',
    ),
  );

  Future<Uint8List> downloadAttachment(
    ThreadsEndpoint endpoint,
    String attachmentId,
  ) => _api.download(endpoint.attachment(attachmentId));

  ThreadDetail _detail(MessagingScope scope, Map<String, Object?> json) {
    final meta = Json.child(json, 'messages_meta');
    return ThreadDetail(
      summary: _summary(scope, json),
      messages: [
        for (final entry in Json.list(json['messages'], 'messages'))
          _message(scope, Json.object(entry, 'message')),
      ],
      earlierCursor: Json.boolean(meta, 'has_more')
          ? Json.stringOrNull(meta, 'next_cursor')
          : null,
    );
  }

  ThreadSummary _summary(MessagingScope scope, Map<String, Object?> json) =>
      scope.isStaff
      ? ThreadSummary.fromStaff(json)
      : ThreadSummary.fromCounterpart(json);

  ThreadMessage _message(MessagingScope scope, Map<String, Object?> json) =>
      scope.isStaff
      ? ThreadMessage.fromStaff(json)
      : ThreadMessage.fromCounterpart(json);
}
