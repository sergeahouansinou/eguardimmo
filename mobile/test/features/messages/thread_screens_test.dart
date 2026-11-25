import 'dart:convert';
import 'dart:typed_data';

import 'package:eguardimmo/core/routes/app_routes.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/api_fixtures.dart';
import '../../helpers/fakes.dart';
import '../../helpers/profile_harness.dart';
import 'messages_api.dart';

Finder _field() => find.byType(TextField);

void main() {
  group('fil', () {
    Future<void> open(WidgetTester tester, FakeHandler handler) async {
      await pumpAsProfile(
        tester,
        profile: TestProfile.tenant,
        handler: handler,
        location: AppRoutes.conversation(threadId),
      );
    }

    testWidgets('messages, accusé de lecture et pièce jointe', (tester) async {
      await open(tester, tenantApi);
      expect(
        find.text('Bonjour, il y a une fuite sous l\'évier.'),
        findsOneWidget,
      );
      expect(
        find.text('Bonjour, je vous confirme le passage demain matin.'),
        findsOneWidget,
      );
      expect(find.text('Marc Dossou'), findsOneWidget);
      expect(find.text('Vous'), findsOneWidget);
      expect(find.textContaining('photo-fuite.jpg'), findsOneWidget);
      expect(find.textContaining('Envoyé'), findsOneWidget);
      expect(find.textContaining('ni un congé'), findsOneWidget);
    });

    testWidgets('pièce jointe : aperçu par téléchargement authentifié', (
      tester,
    ) async {
      final pixel = base64Decode(
        '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
      );
      final harness = await pumpAsProfile(
        tester,
        profile: TestProfile.tenant,
        handler: (call) => call.method == 'DOWNLOAD'
            ? Uint8List.fromList(pixel)
            : tenantApi(call),
        location: AppRoutes.conversation(threadId),
      );
      await tester.tap(find.textContaining('photo-fuite.jpg'));
      await tester.pumpAndSettle();
      final download = harness.api.calls.singleWhere(
        (c) => c.method == 'DOWNLOAD',
      );
      expect(
        download.path,
        '/tenant/conversation-attachments/01a1ef83-0000-7000-8000-000000000001',
      );
      expect(find.byType(Image), findsOneWidget);
    });

    testWidgets('envoi nominal : message ajouté, saisie vidée', (tester) async {
      final harness = await pumpAsProfile(
        tester,
        profile: TestProfile.tenant,
        handler: tenantApi,
        location: AppRoutes.conversation(threadId),
      );
      await tester.enterText(_field(), 'Merci, à demain.');
      await tester.pump();
      await tester.tap(find.byTooltip('Envoyer le message'));
      await tester.pumpAndSettle();
      final post = harness.api.calls.firstWhere((c) => c.method == 'POST');
      final body = post.body! as Map<String, Object?>;
      expect(body['body'], 'Merci, à demain.');
      expect(body['client_id'], isNotEmpty);
      expect(find.text('Merci, à demain.'), findsOneWidget);
      expect(tester.widget<TextField>(_field()).controller!.text, isEmpty);
    });

    testWidgets('envoi refusé en 429 : brouillon conservé, attente annoncée', (
      tester,
    ) async {
      var limited = true;
      final harness = await pumpAsProfile(
        tester,
        profile: TestProfile.tenant,
        handler: (call) {
          if (call.method == 'POST' && limited) {
            return apiProblem('messages/problem_rate_limited', status: 429);
          }
          return tenantApi(call);
        },
        location: AppRoutes.conversation(threadId),
      );
      await tester.enterText(_field(), 'Merci, à demain.');
      await tester.pump();
      await tester.tap(find.byTooltip('Envoyer le message'));
      await tester.pumpAndSettle();
      expect(
        find.text('Trop de requêtes envoyées. Réessayez dans 42 s.'),
        findsOneWidget,
      );
      expect(
        tester.widget<TextField>(_field()).controller!.text,
        'Merci, à demain.',
      );
      limited = false;
      await tester.tap(find.byTooltip('Envoyer le message'));
      await tester.pumpAndSettle();
      final ids = harness.api.calls
          .where((c) => c.method == 'POST')
          .map((c) => (c.body! as Map<String, Object?>)['client_id'])
          .toSet();
      expect(ids, hasLength(1));
      expect(tester.widget<TextField>(_field()).controller!.text, isEmpty);
    });

    testWidgets('fil fermé : lecture seule, aucune saisie', (tester) async {
      await open(
        tester,
        (call) => call.path == '/tenant/conversations/$threadId'
            ? apiFixture('messages/tenant_thread_closed')
            : tenantApi(call),
      );
      expect(find.text('Conversation fermée'), findsOneWidget);
      expect(
        find.textContaining('vous pouvez la relire, sans y répondre'),
        findsOneWidget,
      );
      expect(_field(), findsNothing);
    });

    testWidgets('un nouveau message de l’agence apparaît à l’interrogation', (
      tester,
    ) async {
      await open(
        tester,
        (call) => call.method == 'GET' && call.path.endsWith('/messages')
            ? apiFixture('messages/tenant_messages_after')
            : tenantApi(call),
      );
      expect(find.text('Le plombier passera à 9 h.'), findsNothing);
      await tester.pump(const Duration(seconds: 10));
      await tester.pump();
      expect(find.text('Le plombier passera à 9 h.'), findsOneWidget);
    });

    testWidgets('404 : message du serveur et reprise', (tester) async {
      await open(
        tester,
        (call) => call.path == '/tenant/conversations/$threadId'
            ? problem(
                404,
                'conversation_not_found',
                'Conversation introuvable.',
              )
            : tenantApi(call),
      );
      expect(find.text('Conversation introuvable.'), findsOneWidget);
      expect(find.text('Réessayer'), findsOneWidget);
    });

    testWidgets('mandant : fil en lecture seule sur mobile', (tester) async {
      await pumpAsProfile(
        tester,
        profile: TestProfile.owner,
        handler: (call) {
          if (call.path == '/owner/conversations/$threadId') {
            return apiFixture('messages/tenant_thread');
          }
          return call.path.endsWith('/messages')
              ? apiFixture('messages/tenant_messages_after_empty')
              : null;
        },
        location: AppRoutes.conversation(threadId),
      );
      expect(find.textContaining('lecture seule'), findsOneWidget);
      expect(_field(), findsNothing);
    });

    testWidgets('l’équipe répond et ferme la conversation', (tester) async {
      final harness = await pumpAsProfile(
        tester,
        profile: TestProfile.agency,
        handler: (call) {
          if (call.path.endsWith('/messages')) {
            return call.method == 'POST'
                ? apiFixture('messages/staff_message_posted')
                : apiFixture('messages/tenant_messages_after_empty');
          }
          if (call.method == 'PATCH') {
            return apiFixture('messages/staff_thread_closed');
          }
          return call.path.contains('/conversations/')
              ? apiFixture('messages/staff_thread')
              : null;
        },
        location: AppRoutes.conversation(threadId),
      );
      expect(find.textContaining('ni un congé'), findsNothing);
      await tester.enterText(_field(), 'Nous passons demain.');
      await tester.pump();
      await tester.tap(find.byTooltip('Envoyer le message'));
      await tester.pumpAndSettle();
      expect(find.text('Nous passons demain.'), findsOneWidget);
      await tester.tap(find.byTooltip('Fermer la conversation'));
      await tester.pumpAndSettle();
      final patch = harness.api.calls.lastWhere((c) => c.method == 'PATCH');
      expect(patch.body, {'status': 'closed'});
      expect(find.text('Conversation fermée'), findsOneWidget);
      expect(find.byTooltip('Rouvrir la conversation'), findsOneWidget);
    });

    testWidgets('contenu en texte brut : balises et liens non interprétés', (
      tester,
    ) async {
      const hostile =
          '<b>gras</b> [lien](https://exemple.fr) https://exemple.fr';
      await open(tester, (call) {
        if (call.path == '/tenant/conversations/$threadId') {
          final detail = apiObject('messages/tenant_thread');
          final data = detail['data']! as Map<String, Object?>;
          final messages = (data['messages']! as List<Object?>)
              .cast<Map<String, Object?>>();
          return {
            'data': {
              ...data,
              'messages': [
                {...messages.last, 'body': hostile},
              ],
            },
          };
        }
        return tenantApi(call);
      });
      expect(find.text(hostile), findsOneWidget);
      expect(
        find.byType(InkWell).evaluate().where((e) {
          final text = find.descendant(
            of: find.byWidget(e.widget),
            matching: find.text(hostile),
          );
          return text.evaluate().isNotEmpty;
        }),
        isEmpty,
      );
    });
  });

  group('nouveau message', () {
    testWidgets('bail proposé, envoi puis ouverture du fil créé', (
      tester,
    ) async {
      final harness = await pumpAsProfile(
        tester,
        profile: TestProfile.tenant,
        handler: (call) {
          if (call.path == '/tenant/conversations' && call.method == 'POST') {
            return apiFixture('messages/tenant_thread');
          }
          return tenantApi(call);
        },
        location: AppRoutes.newConversation,
      );
      expect(find.textContaining('B-2026-014'), findsWidgets);
      final fields = find.byType(TextField);
      await tester.enterText(fields.at(0), 'Fuite');
      await tester.enterText(fields.at(1), 'Bonjour, une fuite.');
      await tester.pump();
      await tester.tap(find.text('Envoyer'));
      await tester.pumpAndSettle();
      final post = harness.api.calls.firstWhere(
        (c) => c.method == 'POST' && c.path == '/tenant/conversations',
      );
      final body = post.body! as Map<String, Object?>;
      expect(body['lease_id'], '01a1ef80-1111-7000-8000-000000000b01');
      expect(body['subject'], 'Fuite');
      expect(find.text('Conversation'), findsOneWidget);
    });

    testWidgets('limite de fils ouverts : message du serveur', (tester) async {
      await pumpAsProfile(
        tester,
        profile: TestProfile.tenant,
        handler: (call) {
          if (call.path == '/tenant/conversations' && call.method == 'POST') {
            return apiProblem('messages/problem_open_limit', status: 409);
          }
          return tenantApi(call);
        },
        location: AppRoutes.newConversation,
      );
      final fields = find.byType(TextField);
      await tester.enterText(fields.at(0), 'Fuite');
      await tester.enterText(fields.at(1), 'Bonjour');
      await tester.pump();
      await tester.tap(find.text('Envoyer'));
      await tester.pumpAndSettle();
      expect(find.textContaining('conversations ouvertes'), findsOneWidget);
    });

    testWidgets('profil sans droit d’ouverture : écran indisponible', (
      tester,
    ) async {
      await pumpAsProfile(
        tester,
        profile: TestProfile.owner,
        handler: (_) => null,
        location: AppRoutes.newConversation,
      );
      expect(find.text('Conversation indisponible'), findsOneWidget);
    });
  });
}
