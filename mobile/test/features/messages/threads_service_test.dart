import 'dart:typed_data';

import 'package:eguardimmo/features/messages/models/messaging_scope.dart';
import 'package:eguardimmo/features/messages/models/thread.dart';
import 'package:eguardimmo/features/messages/models/thread_message.dart';
import 'package:eguardimmo/features/messages/services/threads_service.dart';
import 'package:eguardimmo/features/profiles/models/profile_space.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/api_fixtures.dart';
import '../../helpers/fakes.dart';

const _tenant = MessagingScope(space: SpaceKind.tenant);
const _owner = MessagingScope(space: SpaceKind.owner);
const _staff = MessagingScope(
  space: SpaceKind.organization,
  organizationId: 'org-1',
  kinds: [ThreadKind.tenant, ThreadKind.owner],
);

void main() {
  late FakeApiClient api;
  late ThreadsService service;
  late Object? Function(RecordedCall) route;

  setUp(() {
    route = (call) => null;
    api = FakeApiClient((call) => route(call));
    service = ThreadsService(api);
  });

  test('liste du locataire : chemin, pagination et page suivante', () async {
    route = (_) => apiFixture('messages/tenant_threads');
    final page = await service.list(ThreadsEndpoint(_tenant));
    expect(api.calls.single.path, '/tenant/conversations');
    expect(api.calls.single.query, {'per_page': 25});
    expect(page.items, hasLength(2));
    expect(page.hasMore, isTrue);
    expect(page.nextCursor, 'eyJjb25ndiI6Mn0');
  });

  test('filtre non lu : booléen `1` côté locataire', () async {
    route = (_) => apiFixture('messages/tenant_threads_empty');
    final page = await service.list(
      ThreadsEndpoint(_tenant),
      filter: ThreadFilter.unread,
      cursor: 'abc',
    );
    expect(api.calls.single.query, {
      'per_page': 25,
      'cursor': 'abc',
      'unread': '1',
    });
    expect(page.items, isEmpty);
    expect(page.hasMore, isFalse);
  });

  test('liste de l’équipe : type de fil et onglet non lus', () async {
    route = (_) => apiFixture('messages/staff_threads');
    final page = await service.list(
      ThreadsEndpoint(_staff, kind: ThreadKind.owner),
      filter: ThreadFilter.unread,
    );
    expect(api.calls.single.path, '/org/org-1/conversations');
    expect(api.calls.single.query, {
      'per_page': 25,
      'kind': 'owner',
      'tab': 'unread',
    });
    expect(page.items.single.awaitingReply, isTrue);
  });

  test('liste du mandant : chemin propre à son espace', () async {
    route = (_) => apiFixture('messages/tenant_threads_empty');
    await service.list(ThreadsEndpoint(_owner));
    expect(api.calls.single.path, '/owner/conversations');
  });

  test('détail : fil, messages et absence de page antérieure', () async {
    route = (_) => apiFixture('messages/tenant_thread');
    final detail = await service.show(ThreadsEndpoint(_tenant), 'c1');
    expect(api.calls.single.path, '/tenant/conversations/c1');
    expect(detail.messages, hasLength(2));
    expect(detail.hasEarlier, isFalse);
    expect(detail.latest!.authorName, 'Marc Dossou');
  });

  test('détail : un curseur antérieur est exposé quand il y a plus', () async {
    route = (_) => apiFixture('messages/tenant_thread_earlier');
    final detail = await service.show(ThreadsEndpoint(_tenant), 'c1');
    expect(detail.hasEarlier, isTrue);
    expect(detail.earlierCursor, 'eyJpZCI6IjEifQ');
  });

  test('messages après un repère : méta du locataire', () async {
    route = (_) => apiFixture('messages/tenant_messages_after');
    final page = await service.messages(
      ThreadsEndpoint(_tenant),
      'c1',
      after: 'm1',
    );
    expect(api.calls.single.path, '/tenant/conversations/c1/messages');
    expect(api.calls.single.query, {'per_page': 50, 'after': 'm1'});
    expect(page.items.single.body, 'Le plombier passera à 9 h.');
    expect(page.status, ThreadStatus.open);
    expect(page.canReply, isTrue);
    expect(page.counterpartReadAt, isNotNull);
  });

  test('envoi : corps et client_id, message renvoyé', () async {
    route = (_) => apiFixture('messages/tenant_message_posted');
    final message = await service.post(
      ThreadsEndpoint(_tenant),
      'c1',
      body: 'Merci, à demain.',
      clientId: 'cid-1',
    );
    expect(api.calls.single.method, 'POST');
    expect(api.calls.single.path, '/tenant/conversations/c1/messages');
    expect(api.calls.single.body, {
      'body': 'Merci, à demain.',
      'client_id': 'cid-1',
    });
    expect(message.mine, isTrue);
  });

  test('marquage comme lu : PATCH {read: true}', () async {
    route = (_) => apiFixture('messages/tenant_thread');
    await service.markRead(ThreadsEndpoint(_tenant), 'c1');
    expect(api.calls.single.method, 'PATCH');
    expect(api.calls.single.body, {'read': true});
  });

  test('fermeture par l’équipe : PATCH {status: closed}', () async {
    route = (_) => apiFixture('messages/staff_thread_closed');
    final summary = await service.setStatus(
      ThreadsEndpoint(_staff, kind: ThreadKind.tenant),
      'c1',
      ThreadStatus.closed,
    );
    expect(api.calls.single.body, {'status': 'closed'});
    expect(summary.isClosed, isTrue);
  });

  test('ouverture : bail, sujet, corps et client_id', () async {
    route = (_) => apiFixture('messages/tenant_thread');
    final detail = await service.open(
      ThreadsEndpoint(_tenant),
      leaseId: 'bail-1',
      subject: 'Fuite',
      body: 'Bonjour',
      clientId: 'cid-2',
    );
    expect(api.calls.single.path, '/tenant/conversations');
    expect(api.calls.single.body, {
      'lease_id': 'bail-1',
      'subject': 'Fuite',
      'body': 'Bonjour',
      'client_id': 'cid-2',
    });
    expect(detail.summary.id, isNotEmpty);
  });

  test('options d’ouverture', () async {
    route = (_) => apiFixture('messages/tenant_options');
    final options = await service.options(ThreadsEndpoint(_tenant));
    expect(api.calls.single.path, '/tenant/conversations/options');
    expect(options.single.leaseReference, 'B-2026-014');
  });

  test('pièce jointe : téléchargement authentifié par le client', () async {
    route = (_) => Uint8List.fromList([1, 2, 3]);
    final bytes = await service.downloadAttachment(
      ThreadsEndpoint(_tenant),
      'att-1',
    );
    expect(api.calls.single.method, 'DOWNLOAD');
    expect(api.calls.single.path, '/tenant/conversation-attachments/att-1');
    expect(bytes, [1, 2, 3]);
  });

  test('une réponse sans `data` est refusée plutôt que lue de travers', () {
    route = (_) => <String, Object?>{'items': <Object?>[]};
    expect(
      service.show(ThreadsEndpoint(_tenant), 'c1'),
      throwsA(isA<FormatException>()),
    );
  });

  test('un message de l’équipe garde le côté me/team', () async {
    route = (_) => apiFixture('messages/staff_message_posted');
    final message = await service.post(
      ThreadsEndpoint(_staff, kind: ThreadKind.tenant),
      'c1',
      body: 'Nous passons demain.',
      clientId: 'cid-3',
    );
    expect(message.side, MessageSide.me);
  });
}
