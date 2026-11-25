import 'dart:io';

import 'package:dio/dio.dart';
import 'package:eguardimmo/core/services/api_client.dart';
import 'package:eguardimmo/core/services/api_exception.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fakes.dart';
import '../helpers/stub_adapter.dart';

void main() {
  late MemoryTokenStorage storage;
  late StubAdapter adapter;
  var expired = 0;

  ApiClient build(StubResponse Function(RequestOptions) handler) {
    adapter = StubAdapter(handler);
    final dio = Dio()..httpClientAdapter = adapter;
    return ApiClient(
      baseUrl: 'https://api.test/api/v1',
      tokenStorage: storage,
      dio: dio,
    )..onSessionExpired = () => expired += 1;
  }

  setUp(() {
    storage = MemoryTokenStorage('1|jeton-secret');
    expired = 0;
  });

  test('ajoute le jeton Bearer aux requêtes authentifiées', () async {
    final client = build((_) => const StubResponse(200, {'ok': true}));
    await client.get('/me');
    expect(
      adapter.requests.single.headers['Authorization'],
      'Bearer 1|jeton-secret',
    );
    expect(
      adapter.requests.single.uri.toString(),
      'https://api.test/api/v1/me',
    );
  });

  test('n’envoie pas de jeton quand la requête est anonyme', () async {
    final client = build((_) => const StubResponse(201, {}));
    await client.post('/auth/token', body: {'a': 1}, authenticated: false);
    expect(
      adapter.requests.single.headers.containsKey('Authorization'),
      isFalse,
    );
  });

  test('transmet les en-têtes demandés (Idempotency-Key)', () async {
    final client = build(
      (_) => const StubResponse(201, {'data': <String, Object?>{}}),
    );
    await client.post(
      '/marketplace/bookings',
      headers: {'Idempotency-Key': 'k-1'},
    );
    expect(adapter.requests.single.headers['Idempotency-Key'], 'k-1');
  });

  test('401 authentifié : jeton effacé et session déclarée expirée', () async {
    final client = build(
      (_) => const StubResponse(401, {
        'type': 'https://api.test/problems/unauthenticated',
        'title': 'Non authentifié',
        'status': 401,
        'detail': 'Authentification requise.',
        'code': 'unauthenticated',
      }, 'application/problem+json'),
    );
    await expectLater(
      client.get('/me'),
      throwsA(
        isA<ApiException>()
            .having((e) => e.code, 'code', 'unauthenticated')
            .having((e) => e.message, 'message', 'Authentification requise.'),
      ),
    );
    expect(await storage.read(), isNull);
    expect(expired, 1);
  });

  test('401 tardif : une session rouverte entre-temps est conservée', () async {
    final client = build((_) {
      storage.token = '2|nouveau-jeton';
      return const StubResponse(401, {'code': 'unauthenticated'});
    });
    await expectLater(client.get('/me'), throwsA(isA<ApiException>()));
    expect(await storage.read(), '2|nouveau-jeton');
    expect(expired, 0);
  });

  test(
    '401 tardif : déconnexion entre-temps, aucun rappel d’expiration',
    () async {
      final client = build((_) {
        storage.token = null;
        return const StubResponse(401, {'code': 'unauthenticated'});
      });
      await expectLater(client.get('/me'), throwsA(isA<ApiException>()));
      expect(expired, 0);
    },
  );

  test(
    '401 sans jeton envoyé alors qu’un jeton existe maintenant : conservé',
    () async {
      storage.token = null;
      final client = build((_) {
        storage.token = '3|ouvert-pendant-la-requete';
        return const StubResponse(401, {'code': 'unauthenticated'});
      });
      await expectLater(client.get('/me'), throwsA(isA<ApiException>()));
      expect(await storage.read(), '3|ouvert-pendant-la-requete');
      expect(expired, 0);
    },
  );

  test(
    '401 d’une connexion anonyme : le jeton existant est conservé',
    () async {
      final client = build(
        (_) => const StubResponse(401, {'code': 'unauthenticated'}),
      );
      await expectLater(
        client.post('/auth/token', authenticated: false),
        throwsA(isA<ApiException>()),
      );
      expect(await storage.read(), '1|jeton-secret');
      expect(expired, 0);
    },
  );

  test('422 : le premier message de champ devient le message', () async {
    final client = build(
      (_) => const StubResponse(422, {
        'message': 'The given data was invalid.',
        'errors': {
          'email': [
            'Ces identifiants ne correspondent pas à nos enregistrements.',
          ],
        },
      }),
    );
    await expectLater(
      client.post('/auth/token', authenticated: false),
      throwsA(
        isA<ApiException>()
            .having((e) => e.isValidation, 'validation', isTrue)
            .having(
              (e) => e.message,
              'message',
              'Ces identifiants ne correspondent pas à nos enregistrements.',
            ),
      ),
    );
  });

  test('429 : délai de reprise lu dans le corps problem+json', () async {
    final client = build(
      (_) => const StubResponse(429, {
        'status': 429,
        'detail': 'Trop de tentatives.',
        'code': 'too_many_requests',
        'retry_after': 42,
      }, 'application/problem+json'),
    );
    await expectLater(
      client.post('/auth/token', authenticated: false),
      throwsA(
        isA<ApiException>()
            .having((e) => e.isRateLimited, 'limité', isTrue)
            .having((e) => e.retryAfterSeconds, 'retry', 42),
      ),
    );
  });

  group('en-tête Retry-After', () {
    Future<ApiException> limited(String header) async {
      final client = build(
        (_) => StubResponse(
          429,
          const {'status': 429},
          'application/json',
          {
            'retry-after': [header],
          },
        ),
      );
      try {
        await client.get('/me');
      } on ApiException catch (error) {
        return error;
      }
      throw StateError('429 attendu');
    }

    test('nombre de secondes', () async {
      expect((await limited('120')).retryAfterSeconds, 120);
    });

    test('date HTTP : secondes restantes jusqu’à cette date', () async {
      final date = HttpDate.format(
        DateTime.now().toUtc().add(const Duration(seconds: 300)),
      );
      expect(
        (await limited(date)).retryAfterSeconds,
        inInclusiveRange(297, 301),
      );
    });

    test('date HTTP passée : attente nulle', () async {
      final date = HttpDate.format(
        DateTime.now().toUtc().subtract(const Duration(hours: 1)),
      );
      expect((await limited(date)).retryAfterSeconds, 0);
    });

    test('valeur illisible : aucune attente imposée', () async {
      expect((await limited('bientôt')).retryAfterSeconds, isNull);
    });
  });

  test('500 : message générique, jamais le détail brut du serveur', () async {
    final client = build(
      (_) => const StubResponse(500, {'code': 'server_error'}),
    );
    await expectLater(
      client.get('/me'),
      throwsA(
        isA<ApiException>().having(
          (e) => e.message,
          'message',
          contains('momentanément indisponible'),
        ),
      ),
    );
  });

  test('une redirection n’est pas suivie (le jeton ne fuit pas)', () async {
    final client = build(
      (_) => const StubResponse(302, null, 'application/json', {
        'location': ['http://autre.test/'],
      }),
    );
    await expectLater(client.get('/me'), throwsA(isA<ApiException>()));
    expect(adapter.requests, hasLength(1));
  });

  test('refuse une URL de base en clair quand HTTPS est exigé', () {
    expect(
      () => ApiClient(baseUrl: 'http://api.test/api/v1', tokenStorage: storage),
      throwsStateError,
    );
  });

  test('accepte le clair seulement quand HTTPS n’est pas exigé (debug)', () {
    expect(
      () => ApiClient(
        baseUrl: 'http://localhost:8000/api/v1',
        tokenStorage: storage,
        requireHttps: false,
      ),
      returnsNormally,
    );
  });
}
