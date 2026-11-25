import 'package:eguardimmo/features/messages/models/compose_option.dart';
import 'package:eguardimmo/features/messages/models/messaging_scope.dart';
import 'package:eguardimmo/features/messages/models/thread.dart';
import 'package:eguardimmo/features/messages/models/thread_message.dart';
import 'package:eguardimmo/features/profiles/models/profile_space.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/api_fixtures.dart';

Map<String, Object?> first(String name) =>
    ((apiObject(name)['data']! as List<Object?>).first!)
        as Map<String, Object?>;

void main() {
  group('fil vu du locataire', () {
    test('lit le fil non lu avec pièce jointe', () {
      final thread = ThreadSummary.fromCounterpart(
        first('messages/tenant_threads'),
      );
      expect(thread.subject, "Fuite sous l'évier");
      expect(thread.counterpartName, 'Agence Lagune');
      expect(thread.reference, 'Bail B-2026-014');
      expect(thread.status, ThreadStatus.open);
      expect(thread.lastAuthor, MessageSide.team);
      expect(thread.unread, isTrue);
      expect(thread.hasAttachments, isTrue);
      expect(thread.canReply, isTrue);
      expect(thread.counterpartReadAt, isNull);
      expect(thread.lastMessageAt.toUtc(), DateTime.utc(2026, 11, 20, 9, 15));
    });

    test('un fil fermé n’accepte pas de réponse', () {
      final raw =
          (apiObject('messages/tenant_threads')['data']! as List<Object?>)[1]!
              as Map<String, Object?>;
      final thread = ThreadSummary.fromCounterpart(raw);
      expect(thread.isClosed, isTrue);
      expect(thread.canReply, isFalse);
      expect(thread.lastAuthor, MessageSide.me);
      expect(thread.counterpartReadAt, isNotNull);
    });

    test('un statut inconnu est refusé, pas deviné', () {
      final raw = {...first('messages/tenant_threads'), 'status': 'archived'};
      expect(() => ThreadSummary.fromCounterpart(raw), throwsFormatException);
    });

    test('une clé obligatoire absente est refusée', () {
      final raw = {...first('messages/tenant_threads')}..remove('subject');
      expect(() => ThreadSummary.fromCounterpart(raw), throwsFormatException);
    });
  });

  group('messages', () {
    final messages =
        (apiObject('messages/tenant_thread')['data']!
                as Map<String, Object?>)['messages']!
            as List<Object?>;

    test('message envoyé par moi avec pièce jointe', () {
      final message = ThreadMessage.fromCounterpart(
        messages.first! as Map<String, Object?>,
      );
      expect(message.mine, isTrue);
      expect(message.side, MessageSide.me);
      expect(message.clientId, isNotNull);
      expect(message.attachments.single.name, 'photo-fuite.jpg');
      expect(message.attachments.single.mimeType, 'image/jpeg');
      expect(message.attachments.single.sizeBytes, 245760);
    });

    test('message de l’agence : prénom et nom, pas de client_id', () {
      final message = ThreadMessage.fromCounterpart(
        messages.last! as Map<String, Object?>,
      );
      expect(message.side, MessageSide.team);
      expect(message.mine, isFalse);
      expect(message.clientId, isNull);
      expect(message.authorName, 'Marc Dossou');
    });

    test('côté équipe : mon message est « moi », celui d’un collègue non', () {
      final raw =
          (apiObject('messages/staff_message_posted')['data']!
              as Map<String, Object?>);
      expect(ThreadMessage.fromStaff(raw).side, MessageSide.me);
      expect(
        ThreadMessage.fromStaff({...raw, 'mine': false}).side,
        MessageSide.team,
      );
    });

    test('côté équipe : le locataire est la contrepartie', () {
      final raw =
          ((apiObject('messages/staff_thread')['data']!
                          as Map<String, Object?>)['messages']!
                      as List<Object?>)
                  .first!
              as Map<String, Object?>;
      expect(ThreadMessage.fromStaff(raw).side, MessageSide.counterpart);
    });

    test('un côté d’auteur inconnu est refusé', () {
      final raw = {
        ...(messages.last! as Map<String, Object?>),
        'author': {'side': 'robot', 'name': 'x'},
      };
      expect(() => ThreadMessage.fromCounterpart(raw), throwsFormatException);
    });
  });

  group('fil vu de l’équipe', () {
    test('en attente de réponse, locataire en contrepartie', () {
      final thread = ThreadSummary.fromStaff(first('messages/staff_threads'));
      expect(thread.counterpartName, 'Awa Kpossou');
      expect(thread.awaitingReply, isTrue);
      expect(thread.lastAuthor, MessageSide.counterpart);
      expect(thread.canReply, isTrue);
    });
  });

  test('options d’ouverture : bail et agence', () {
    final option = ComposeOption.fromJson(first('messages/tenant_options'));
    expect(option.label, 'Bail B-2026-014 · Agence Lagune');
  });

  group('périmètre selon le profil', () {
    test('le voyageur n’a pas de messagerie', () {
      expect(MessagingScope.of(ProfileSpace.traveler), isNull);
    });

    test('locataire : écrit, ouvre, ne ferme pas', () {
      final scope = MessagingScope.of(
        const ProfileSpace(kind: SpaceKind.tenant),
      )!;
      expect(scope.canWrite, isTrue);
      expect(scope.canOpenThread, isTrue);
      expect(scope.canCloseThread, isFalse);
      expect(ThreadsEndpoint(scope).conversations, '/tenant/conversations');
    });

    test('mandant : lecture seule, jeton personnel refusé en écriture', () {
      final scope = MessagingScope.of(
        const ProfileSpace(kind: SpaceKind.owner),
      )!;
      expect(scope.canWrite, isFalse);
      expect(scope.canMarkRead, isFalse);
      expect(scope.canOpenThread, isFalse);
      expect(ThreadsEndpoint(scope).conversations, '/owner/conversations');
    });

    test('agence : deux types de fils, fermeture permise', () {
      final scope = MessagingScope.of(
        const ProfileSpace(
          kind: SpaceKind.organization,
          organizationId: 'org-1',
          agency: true,
        ),
      )!;
      expect(scope.kinds, [ThreadKind.tenant, ThreadKind.owner]);
      expect(scope.canCloseThread, isTrue);
      expect(scope.canOpenThread, isFalse);
      final endpoint = ThreadsEndpoint(scope, kind: ThreadKind.tenant);
      expect(endpoint.messages('c1'), '/org/org-1/conversations/c1/messages');
      expect(
        endpoint.attachment('a1'),
        '/org/org-1/conversation-attachments/a1',
      );
    });

    test('bailleur autonome : fils locataires seulement', () {
      final scope = MessagingScope.of(
        const ProfileSpace(kind: SpaceKind.organization, organizationId: 'o'),
      )!;
      expect(scope.kinds, [ThreadKind.tenant]);
    });

    test('deux organisations ont des clés distinctes', () {
      const a = MessagingScope(
        space: SpaceKind.organization,
        organizationId: 'a',
      );
      const b = MessagingScope(
        space: SpaceKind.organization,
        organizationId: 'b',
      );
      expect(a.key, isNot(b.key));
    });
  });
}
