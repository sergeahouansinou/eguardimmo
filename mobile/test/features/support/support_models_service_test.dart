import 'dart:typed_data';

import 'package:eguardimmo/features/support/models/support_availability.dart';
import 'package:eguardimmo/features/support/models/support_enums.dart';
import 'package:eguardimmo/features/support/models/ticket.dart';
import 'package:eguardimmo/features/support/models/ticket_message.dart';
import 'package:eguardimmo/features/support/services/support_service.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/api_fixtures.dart';
import '../../helpers/fakes.dart';

void main() {
  late FakeApiClient api;
  late SupportService service;
  late Object? Function(RecordedCall) route;

  setUp(() {
    route = (call) => null;
    api = FakeApiClient((call) => route(call));
    service = SupportService(api);
  });

  group('modèles', () {
    test('disponibilité', () {
      final status = SupportAvailability.fromJson(
        apiObject('support/status_online')['data']! as Map<String, Object?>,
      );
      expect(status.online, isTrue);
      expect(status.responseLabel, 'Réponse sous 1 jour ouvré');
      expect(status.timezone, 'Europe/Paris');
    });

    test('demande prise en charge : libellé générique, jamais l’opérateur', () {
      final raw =
          (apiObject('support/tickets')['data']! as List<Object?>).first!
              as Map<String, Object?>;
      final ticket = TicketSummary.fromJson(raw);
      expect(ticket.handled, isTrue);
      expect(ticket.status, TicketStatus.waiting);
      expect(ticket.category, TicketCategory.account);
      expect(ticket.requesterLastReadAt, isNull);
      expect(ticket.messageCount, 2);
    });

    test('statut ou catégorie inconnus : refusés', () {
      final raw =
          (apiObject('support/tickets')['data']! as List<Object?>).first!
              as Map<String, Object?>;
      expect(
        () => TicketSummary.fromJson({...raw, 'status': 'closed'}),
        throwsFormatException,
      );
      expect(
        () => TicketSummary.fromJson({...raw, 'category': 'legal'}),
        throwsFormatException,
      );
    });

    test('détail : réponse du support non lue détectée', () {
      final detail = TicketDetail.fromJson(
        apiObject('support/ticket')['data']! as Map<String, Object?>,
      );
      expect(detail.messages, hasLength(2));
      expect(detail.messages.last.fromSupport, isTrue);
      expect(detail.messages.last.authorName, 'Support eGuardImmo');
      expect(detail.hasUnreadSupportReply, isTrue);
      expect(detail.hasMore, isFalse);
    });

    test('détail résolu : réponse déjà lue', () {
      final detail = TicketDetail.fromJson(
        apiObject('support/ticket_resolved')['data']! as Map<String, Object?>,
      );
      expect(detail.summary.isResolved, isTrue);
      expect(detail.hasUnreadSupportReply, isFalse);
    });

    test('pièce jointe de message', () {
      final message = TicketMessage.fromJson({
        'id': 'm1',
        'author': {'id': null, 'name': 'Support eGuardImmo', 'support': true},
        'body': 'Voir pièce jointe',
        'internal': false,
        'sent_at': '2026-11-20T08:00:00+00:00',
        'attachments': [
          {
            'id': 'a1',
            'name': 'guide.pdf',
            'mime_type': 'application/pdf',
            'size_bytes': 1024,
          },
        ],
      });
      expect(message.attachments.single.name, 'guide.pdf');
      expect(message.attachments.single.sizeBytes, 1024);
    });
  });

  group('service', () {
    test('statut du support', () async {
      route = (_) => apiFixture('support/status_offline');
      final status = await service.status();
      expect(api.calls.single.path, '/support/status');
      expect(status.online, isFalse);
    });

    test('liste des demandes : pagination par curseur', () async {
      route = (_) => apiFixture('support/tickets');
      final page = await service.tickets(cursor: 'c1');
      expect(api.calls.single.path, '/support/tickets');
      expect(api.calls.single.query, {'per_page': 50, 'cursor': 'c1'});
      expect(page.items, hasLength(2));
      expect(page.hasMore, isFalse);
    });

    test('liste vide', () async {
      route = (_) => apiFixture('support/tickets_empty');
      expect((await service.tickets()).items, isEmpty);
    });

    test('messages après un repère, avec le statut', () async {
      route = (_) => apiFixture('support/ticket_messages_after');
      final page = await service.messages('t1', after: 'm2');
      expect(api.calls.single.path, '/support/tickets/t1/messages');
      expect(api.calls.single.query, {'per_page': 50, 'after': 'm2'});
      expect(page.items.single.fromSupport, isTrue);
      expect(page.status, TicketStatus.waiting);
    });

    test('ouverture : espace, organisation, catégorie, client_id', () async {
      route = (_) => apiFixture('support/ticket_opened');
      final detail = await service.open(
        space: 'organization',
        organizationId: 'org-1',
        category: TicketCategory.documents,
        subject: 'Sujet',
        body: 'Corps',
        clientId: 'cid-1',
      );
      expect(api.calls.single.method, 'POST');
      expect(api.calls.single.path, '/support/tickets');
      expect(api.calls.single.body, {
        'space': 'organization',
        'organization_id': 'org-1',
        'category': 'documents',
        'subject': 'Sujet',
        'body': 'Corps',
        'client_id': 'cid-1',
      });
      expect(detail.summary.reference, 'SUP-2026-0003');
    });

    test('ouverture hors organisation : pas de organization_id', () async {
      route = (_) => apiFixture('support/ticket_opened');
      await service.open(
        space: 'tenant',
        organizationId: null,
        category: TicketCategory.other,
        subject: 'S',
        body: 'C',
        clientId: 'cid-1',
      );
      expect(
        (api.calls.single.body! as Map<String, Object?>).containsKey(
          'organization_id',
        ),
        isFalse,
      );
    });

    test('réponse : corps et client_id', () async {
      route = (_) => apiFixture('support/ticket_replied');
      final detail = await service.reply('t1', body: 'Bonjour', clientId: 'c');
      expect(api.calls.single.path, '/support/tickets/t1/messages');
      expect(api.calls.single.body, {'body': 'Bonjour', 'client_id': 'c'});
      expect(detail.messages, hasLength(3));
    });

    test('marquage comme lu : seul champ autorisé au demandeur', () async {
      route = (_) => apiFixture('support/ticket');
      await service.markRead('t1');
      expect(api.calls.single.method, 'PATCH');
      expect(api.calls.single.body, {'read': true});
    });

    test('pièce jointe : téléchargement authentifié', () async {
      route = (_) => Uint8List.fromList([9, 8]);
      final bytes = await service.downloadAttachment(
        const TicketAttachment(
          id: 'a1',
          name: 'g.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 2,
        ),
      );
      expect(api.calls.single.path, '/support/attachments/a1');
      expect(bytes, [9, 8]);
    });
  });
}
