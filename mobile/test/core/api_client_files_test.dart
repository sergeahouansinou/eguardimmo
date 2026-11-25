import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:eguardimmo/core/services/api_client.dart';
import 'package:eguardimmo/core/services/api_exception.dart';
import 'package:eguardimmo/core/services/file_rejected_exception.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fakes.dart';
import '../helpers/stub_adapter.dart';

class _BytesAdapter(
  final int status,
  final List<int> bytes, {
  final String contentType = 'application/pdf',
}) implements HttpClientAdapter {
  final List<RequestOptions> requests = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    return ResponseBody.fromBytes(
      bytes,
      status,
      headers: {
        Headers.contentTypeHeader: [contentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

class _ChunkedAdapter(
  final int chunks,
  final int chunkSize, {
  final int? declaredLength,
}) implements HttpClientAdapter {
  int emitted = 0;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    Stream<Uint8List> body() async* {
      for (var i = 0; i < chunks; i++) {
        emitted++;
        await Future<void>.delayed(Duration.zero);
        yield Uint8List(chunkSize);
      }
    }

    return ResponseBody(
      body(),
      200,
      headers: {
        Headers.contentTypeHeader: ['image/png'],
        if (declaredLength != null)
          Headers.contentLengthHeader: ['$declaredLength'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

ApiClient build(HttpClientAdapter adapter, MemoryTokenStorage storage) =>
    ApiClient(
      baseUrl: 'https://api.test/api/v1',
      tokenStorage: storage,
      dio: Dio()..httpClientAdapter = adapter,
    );

void main() {
  late MemoryTokenStorage storage;

  setUp(() => storage = MemoryTokenStorage('1|jeton-secret'));

  test('patch envoie le corps JSON avec le jeton', () async {
    final adapter = StubAdapter(
      (_) => const StubResponse(200, {'data': <String, Object?>{}}),
    );
    await build(
      adapter,
      storage,
    ).patch('/tenant/conversations/1', body: {'read': true});
    final request = adapter.requests.single;
    expect(request.method, 'PATCH');
    expect(request.data, {'read': true});
    expect(request.headers['Authorization'], 'Bearer 1|jeton-secret');
  });

  test('download renvoie les octets, avec le jeton', () async {
    final adapter = _BytesAdapter(200, [1, 2, 3, 4], contentType: 'image/png');
    final bytes = await build(
      adapter,
      storage,
    ).download('/tenant/conversation-attachments/9');
    expect(bytes, [1, 2, 3, 4]);
    expect(
      adapter.requests.single.headers['Authorization'],
      'Bearer 1|jeton-secret',
    );
    expect(adapter.requests.single.method, 'GET');
  });

  test('download : une erreur problem+json devient un ApiException', () async {
    final adapter = _BytesAdapter(
      404,
      utf8.encode(
        jsonEncode({
          'type': 'https://api.test/problems/attachment_not_found',
          'title': 'Pièce jointe introuvable',
          'status': 404,
          'detail': 'Pièce jointe introuvable.',
          'code': 'attachment_not_found',
        }),
      ),
      contentType: 'application/problem+json',
    );
    await expectLater(
      build(adapter, storage).download('/support/attachments/1'),
      throwsA(
        isA<ApiException>()
            .having((e) => e.statusCode, 'statusCode', 404)
            .having((e) => e.code, 'code', 'attachment_not_found')
            .having((e) => e.message, 'message', 'Pièce jointe introuvable.'),
      ),
    );
  });

  test('download : un 429 garde Retry-After', () async {
    final adapter = _BytesAdapter(
      429,
      utf8.encode(
        jsonEncode({
          'status': 429,
          'detail': 'Trop de tentatives. Réessayez plus tard.',
          'code': 'too_many_requests',
          'retry_after': 12,
        }),
      ),
      contentType: 'application/problem+json',
    );
    await expectLater(
      build(adapter, storage).download('/support/attachments/1'),
      throwsA(
        isA<ApiException>()
            .having((e) => e.isRateLimited, 'isRateLimited', isTrue)
            .having((e) => e.retryAfterSeconds, 'retryAfterSeconds', 12),
      ),
    );
  });

  test('download : un 401 efface la session', () async {
    var expired = 0;
    final adapter = _BytesAdapter(
      401,
      utf8.encode(jsonEncode({'status': 401, 'detail': 'Non authentifié.'})),
    );
    final client = build(adapter, storage)..onSessionExpired = () => expired++;
    await expectLater(
      client.download('/support/attachments/1'),
      throwsA(isA<ApiException>()),
    );
    expect(expired, 1);
    expect(await storage.read(), isNull);
  });

  group('download : garde-fous', () {
    test('Content-Type hors liste blanche : refusé', () async {
      final adapter = _BytesAdapter(200, [1, 2, 3]);
      await expectLater(
        build(adapter, storage).download('/support/attachments/1'),
        throwsA(isA<FileRejectedException>()),
      );
    });

    test('Content-Type avec paramètres et casse libre : accepté', () async {
      final adapter = _BytesAdapter(200, [
        1,
        2,
        3,
      ], contentType: 'IMAGE/PNG; charset=binary');
      final bytes = await build(
        adapter,
        storage,
      ).download('/support/attachments/1');
      expect(bytes, [1, 2, 3]);
    });

    test(
      'réponse plus lourde qu’annoncé : annulée dès le dépassement',
      () async {
        final adapter = _ChunkedAdapter(200, 50, declaredLength: 100);
        await expectLater(
          build(
            adapter,
            storage,
          ).download('/support/attachments/1', maxBytes: 1000),
          throwsA(isA<FileRejectedException>()),
        );
        expect(adapter.emitted, lessThan(200));
      },
    );

    test('taille annoncée au-delà du plafond : refusée', () async {
      final adapter = _ChunkedAdapter(2, 50, declaredLength: 5000);
      await expectLater(
        build(
          adapter,
          storage,
        ).download('/support/attachments/1', maxBytes: 1000),
        throwsA(isA<FileRejectedException>()),
      );
    });

    test('exactement au plafond : accepté', () async {
      final adapter = _ChunkedAdapter(4, 250);
      final bytes = await build(
        adapter,
        storage,
      ).download('/support/attachments/1', maxBytes: 1000);
      expect(bytes, hasLength(1000));
    });
  });
}
