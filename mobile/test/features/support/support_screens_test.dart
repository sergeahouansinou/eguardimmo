import 'package:eguardimmo/core/routes/app_routes.dart';
import 'package:eguardimmo/features/profiles/models/app_profile.dart';
import 'package:eguardimmo/features/profiles/viewmodels/profiles_viewmodel.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import '../../helpers/api_fixtures.dart';
import '../../helpers/fakes.dart';
import '../../helpers/fixtures.dart';
import '../../helpers/harness.dart';
import '../../helpers/profile_harness.dart';

const _ticketId = '01a1ef90-0000-7000-8000-000000000001';

Object? _supportApi(RecordedCall call) {
  final path = call.path;
  if (path == '/support/status') {
    return apiFixture('support/status_online');
  }
  if (path == '/support/tickets') {
    return call.method == 'POST'
        ? apiFixture('support/ticket_opened')
        : apiFixture('support/tickets');
  }
  if (path == '/support/tickets/$_ticketId/messages') {
    return call.method == 'POST'
        ? apiFixture('support/ticket_replied')
        : apiFixture('support/ticket_messages_after_empty');
  }
  if (path == '/support/tickets/$_ticketId') {
    return apiFixture('support/ticket');
  }
  return null;
}

Finder _field() => find.byType(TextField);

void main() {
  group('accueil du support', () {
    testWidgets('en ligne : horaires du serveur, demandes et limites', (
      tester,
    ) async {
      await pumpAsProfile(
        tester,
        profile: TestProfile.tenant,
        handler: _supportApi,
        location: AppRoutes.support,
      );
      expect(find.text('Support en ligne'), findsOneWidget);
      expect(find.text('Lun–ven 9 h – 18 h (Europe/Paris)'), findsOneWidget);
      expect(find.text('Réponse sous 1 jour ouvré'), findsOneWidget);
      expect(find.text('Accès à mon compte'), findsOneWidget);
      expect(find.text('Question sur une facture'), findsOneWidget);
      expect(find.text('Réponse du support'), findsOneWidget);
      expect(find.text('Résolue'), findsOneWidget);
      expect(
        find.textContaining('ne lit jamais vos conversations'),
        findsOneWidget,
      );
    });

    testWidgets('hors ligne : état annoncé tel que le serveur le donne', (
      tester,
    ) async {
      await pumpAsProfile(
        tester,
        profile: TestProfile.tenant,
        handler: (call) => call.path == '/support/status'
            ? apiFixture('support/status_offline')
            : _supportApi(call),
        location: AppRoutes.support,
      );
      expect(find.text('Support hors ligne'), findsOneWidget);
      expect(find.text('Support en ligne'), findsNothing);
    });

    testWidgets('horaires indisponibles : message et reprise', (tester) async {
      var failing = true;
      await pumpAsProfile(
        tester,
        profile: TestProfile.tenant,
        handler: (call) {
          if (call.path == '/support/status' && failing) {
            return apiProblem('support/problem_hours_unavailable', status: 503);
          }
          return _supportApi(call);
        },
        location: AppRoutes.support,
      );
      expect(
        find.textContaining('Horaires du support indisponibles'),
        findsOneWidget,
      );
      expect(find.text('Support en ligne'), findsNothing);
      expect(find.text('Nouvelle demande'), findsOneWidget);
      failing = false;
      await tester.tap(find.text('Réessayer'));
      await tester.pumpAndSettle();
      expect(find.text('Support en ligne'), findsOneWidget);
    });

    testWidgets('aucune demande : invitation à en ouvrir une', (tester) async {
      await pumpAsProfile(
        tester,
        profile: TestProfile.tenant,
        handler: (call) => call.path == '/support/tickets'
            ? apiFixture('support/tickets_empty')
            : _supportApi(call),
        location: AppRoutes.support,
      );
      expect(find.textContaining('Vous n’avez aucune demande'), findsOneWidget);
    });

    testWidgets('403 e-mail non vérifié : message du serveur', (tester) async {
      await pumpAsProfile(
        tester,
        profile: TestProfile.tenant,
        handler: (call) => call.path == '/support/tickets'
            ? apiProblem('support/problem_email_unverified', status: 403)
            : _supportApi(call),
        location: AppRoutes.support,
      );
      expect(
        find.text('Confirmez votre adresse e-mail pour accéder à cet espace.'),
        findsOneWidget,
      );
    });

    testWidgets('429 : attente annoncée', (tester) async {
      await pumpAsProfile(
        tester,
        profile: TestProfile.tenant,
        handler: (call) => call.path == '/support/tickets'
            ? apiProblem('support/problem_rate_limited', status: 429)
            : _supportApi(call),
        location: AppRoutes.support,
      );
      expect(
        find.text('Trop de requêtes envoyées. Réessayez dans 30 min.'),
        findsOneWidget,
      );
    });

    testWidgets('accessible au voyageur, sans conversation', (tester) async {
      await pumpAsProfile(
        tester,
        profile: TestProfile.traveler,
        handler: _supportApi,
        location: AppRoutes.support,
      );
      expect(find.text('Support en ligne'), findsOneWidget);
    });

    testWidgets('accès depuis l’onglet Messages', (tester) async {
      await pumpAsProfile(
        tester,
        profile: TestProfile.tenant,
        handler: (call) => call.path == '/tenant/conversations'
            ? apiFixture('messages/tenant_threads_empty')
            : _supportApi(call),
      );
      await tester.tap(find.text('Support eGuardImmo'));
      await tester.pumpAndSettle();
      expect(find.text('Mes demandes'), findsOneWidget);
    });

    testWidgets('320 px et texte x1,6 : aucun débordement', (tester) async {
      await pumpAsProfile(
        tester,
        profile: TestProfile.tenant,
        handler: _supportApi,
        location: AppRoutes.support,
        size: const Size(320, 640),
        textScale: 1.6,
      );
      expect(tester.takeException(), isNull);
    });
  });

  group('nouvelle demande', () {
    Future<void> fill(WidgetTester tester) async {
      final fields = find.byType(TextField);
      await tester.enterText(fields.at(0), 'Mon bail');
      await tester.enterText(fields.at(1), 'Je ne vois pas mon bail.');
      await tester.pump();
    }

    testWidgets('limites affichées, envoi puis ouverture de la demande', (
      tester,
    ) async {
      final harness = await pumpAsProfile(
        tester,
        profile: TestProfile.tenant,
        handler: _supportApi,
        location: AppRoutes.newSupportTicket,
      );
      expect(
        find.text('Vous pouvez ouvrir 5 demandes par heure et 20 par jour.'),
        findsOneWidget,
      );
      await fill(tester);
      await tester.ensureVisible(find.text('Envoyer la demande'));
      await tester.tap(find.text('Envoyer la demande'));
      await tester.pumpAndSettle();
      final post = harness.api.calls.firstWhere(
        (c) => c.method == 'POST' && c.path == '/support/tickets',
      );
      final body = post.body! as Map<String, Object?>;
      expect(body['space'], 'tenant');
      expect(body['category'], 'other');
      expect(body['subject'], 'Mon bail');
      expect(find.text('Demande'), findsOneWidget);
    });

    testWidgets('champs obligatoires : rien n’est envoyé à vide', (
      tester,
    ) async {
      final harness = await pumpAsProfile(
        tester,
        profile: TestProfile.tenant,
        handler: _supportApi,
        location: AppRoutes.newSupportTicket,
      );
      await tester.ensureVisible(find.text('Envoyer la demande'));
      await tester.tap(find.text('Envoyer la demande'));
      await tester.pumpAndSettle();
      expect(find.text('Indiquez un objet'), findsOneWidget);
      expect(find.text('Décrivez votre demande'), findsOneWidget);
      expect(harness.api.calls.where((c) => c.method == 'POST'), isEmpty);
    });

    testWidgets('429 : limite annoncée, saisie conservée', (tester) async {
      await pumpAsProfile(
        tester,
        profile: TestProfile.tenant,
        handler: (call) => call.method == 'POST'
            ? apiProblem('support/problem_rate_limited', status: 429)
            : _supportApi(call),
        location: AppRoutes.newSupportTicket,
      );
      await fill(tester);
      await tester.ensureVisible(find.text('Envoyer la demande'));
      await tester.tap(find.text('Envoyer la demande'));
      await tester.pumpAndSettle();
      expect(
        find.text('Trop de requêtes envoyées. Réessayez dans 30 min.'),
        findsOneWidget,
      );
      expect(find.text('Mon bail'), findsOneWidget);
      expect(find.text('Je ne vois pas mon bail.'), findsOneWidget);
    });

    testWidgets('changement de profil actif : formulaire recréé, espace du nouveau profil '
        'transmis', (tester) async {
      final harness = await pumpApp(
        tester,
        handler: _supportApi,
        profiles: [Fixtures.tenantProfile(), Fixtures.ownerProfile()],
      );
      addTearDown(() async {
        await tester.pumpWidget(const SizedBox());
        await tester.pump();
      });
      final profiles = Provider.of<ProfilesViewModel>(
        tester.element(find.byType(MaterialApp)),
        listen: false,
      );
      profiles.select(
        profiles.profiles.firstWhere((p) => p.kind == ProfileKind.tenant),
      );
      harness.router.go(AppRoutes.newSupportTicket);
      await tester.pumpAndSettle();
      await fill(tester);
      expect(find.text('Mon bail'), findsOneWidget);

      profiles.select(
        profiles.profiles.firstWhere((p) => p.kind == ProfileKind.owner),
      );
      await tester.pumpAndSettle();
      expect(find.text('Mon bail'), findsNothing);

      await fill(tester);
      await tester.ensureVisible(find.text('Envoyer la demande'));
      await tester.tap(find.text('Envoyer la demande'));
      await tester.pumpAndSettle();
      final post = harness.api.calls.firstWhere((c) => c.method == 'POST');
      expect((post.body! as Map<String, Object?>)['space'], 'owner');
    });

    testWidgets('profil agence : l’organisation est transmise', (tester) async {
      final harness = await pumpAsProfile(
        tester,
        profile: TestProfile.agency,
        handler: _supportApi,
        location: AppRoutes.newSupportTicket,
      );
      await fill(tester);
      await tester.ensureVisible(find.text('Envoyer la demande'));
      await tester.tap(find.text('Envoyer la demande'));
      await tester.pumpAndSettle();
      final post = harness.api.calls.firstWhere((c) => c.method == 'POST');
      final body = post.body! as Map<String, Object?>;
      expect(body['space'], 'organization');
      expect(body['organization_id'], '0193d2a0-0000-7000-8000-0000000000aa');
    });
  });

  group('fil d’une demande', () {
    Future<Harness> open(WidgetTester tester, FakeHandler handler) =>
        pumpAsProfile(
          tester,
          profile: TestProfile.tenant,
          handler: handler,
          location: AppRoutes.supportTicket(_ticketId),
        );

    testWidgets('messages, auteur anonymisé et statut', (tester) async {
      await open(tester, _supportApi);
      expect(find.text('Accès à mon compte'), findsOneWidget);
      expect(find.text('Je n\'arrive plus à me connecter.'), findsOneWidget);
      expect(find.text('Support eGuardImmo'), findsOneWidget);
      expect(find.text('Vous'), findsOneWidget);
      expect(find.text('Réponse du support'), findsOneWidget);
      expect(find.textContaining('SUP-2026-0001'), findsOneWidget);
    });

    testWidgets('réponse nominale : message ajouté, saisie vidée', (
      tester,
    ) async {
      final harness = await open(tester, _supportApi);
      await tester.enterText(
        _field(),
        'Il indique « identifiants invalides ».',
      );
      await tester.pump();
      await tester.tap(find.byTooltip('Envoyer le message'));
      await tester.pumpAndSettle();
      final post = harness.api.calls.firstWhere((c) => c.method == 'POST');
      final body = post.body! as Map<String, Object?>;
      expect(body['body'], 'Il indique « identifiants invalides ».');
      expect(body['client_id'], isNotEmpty);
      expect(
        find.text('Il indique « identifiants invalides ».'),
        findsOneWidget,
      );
      expect(tester.widget<TextField>(_field()).controller!.text, isEmpty);
    });

    testWidgets('429 : brouillon conservé et renvoi avec le même client_id', (
      tester,
    ) async {
      var limited = true;
      final harness = await open(tester, (call) {
        if (call.method == 'POST' && limited) {
          return apiProblem('support/problem_rate_limited', status: 429);
        }
        return _supportApi(call);
      });
      await tester.enterText(_field(), 'Bonjour');
      await tester.pump();
      await tester.tap(find.byTooltip('Envoyer le message'));
      await tester.pumpAndSettle();
      expect(
        find.text('Trop de requêtes envoyées. Réessayez dans 30 min.'),
        findsOneWidget,
      );
      expect(tester.widget<TextField>(_field()).controller!.text, 'Bonjour');
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

    testWidgets('demande résolue : la réponse la rouvre, le dit', (
      tester,
    ) async {
      await open(
        tester,
        (call) =>
            call.path == '/support/tickets/$_ticketId' && call.method == 'GET'
            ? apiFixture('support/ticket_resolved')
            : _supportApi(call),
      );
      expect(find.text('Résolue'), findsOneWidget);
      expect(find.textContaining('la rouvre pendant 14 jours'), findsOneWidget);
      expect(_field(), findsOneWidget);
    });

    testWidgets('une réponse du support apparaît à l’interrogation', (
      tester,
    ) async {
      await open(
        tester,
        (call) => call.method == 'GET' && call.path.endsWith('/messages')
            ? apiFixture('support/ticket_messages_after')
            : _supportApi(call),
      );
      expect(find.text('Merci, nous regardons.'), findsNothing);
      await tester.pump(const Duration(seconds: 10));
      await tester.pump();
      expect(find.text('Merci, nous regardons.'), findsOneWidget);
    });

    testWidgets('404 : message du serveur et reprise', (tester) async {
      await open(
        tester,
        (call) => call.path == '/support/tickets/$_ticketId'
            ? apiProblem('support/problem_ticket_not_found', status: 404)
            : _supportApi(call),
      );
      expect(find.text('Demande introuvable.'), findsOneWidget);
      expect(find.text('Réessayer'), findsOneWidget);
    });
  });
}
