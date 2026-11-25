import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:eguardimmo/core/services/api_client.dart';
import 'package:eguardimmo/core/services/api_exception.dart';
import 'package:eguardimmo/core/services/token_storage.dart';

class MemoryTokenStorage([var String? token]) implements TokenStorage {
  @override
  Future<void> clear() async => token = null;

  @override
  Future<String?> read() async => token;

  @override
  Future<void> write(String value) async => token = value;
}

class const RecordedCall(
  final String method,
  final String path, {
  final Object? body,
  final Map<String, Object?>? query,
  final Map<String, String>? headers,
  final bool authenticated = true,
}) {}

typedef FakeHandler = Object? Function(RecordedCall call);

/// Faux ApiClient : le handler renvoie la charge utile JSON attendue, ou un
/// ApiException à lever. Les fixtures doivent reproduire exactement la réponse
/// du vrai endpoint.
class FakeApiClient(var FakeHandler handler, {MemoryTokenStorage? storage})
    extends ApiClient {
  this
    : _storage = storage ?? MemoryTokenStorage(),
      super(
        baseUrl: 'http://fake.test',
        tokenStorage: storage ?? MemoryTokenStorage(),
        requireHttps: false,
      );

  final MemoryTokenStorage _storage;

  final List<RecordedCall> calls = [];

  Future<Object?> _answer(RecordedCall call) async {
    calls.add(call);
    final result = handler(call);
    if (result is ApiException) {
      if (result.isUnauthorized &&
          call.authenticated &&
          await _storage.read() != null) {
        await _storage.clear();
        onSessionExpired?.call();
      }
      throw result;
    }
    return result;
  }

  @override
  Future<Object?> get(
    String path, {
    Map<String, Object?>? query,
    CancelToken? cancelToken,
  }) => _answer(RecordedCall('GET', path, query: query));

  @override
  Future<Object?> post(
    String path, {
    Object? body,
    bool authenticated = true,
    Map<String, String>? headers,
  }) => _answer(
    RecordedCall(
      'POST',
      path,
      body: body,
      headers: headers,
      authenticated: authenticated,
    ),
  );

  @override
  Future<Object?> put(String path, {Object? body}) =>
      _answer(RecordedCall('PUT', path, body: body));

  @override
  Future<Object?> patch(String path, {Object? body}) =>
      _answer(RecordedCall('PATCH', path, body: body));

  @override
  Future<Uint8List> download(
    String path, {
    int maxBytes = ApiClient.defaultMaxDownloadBytes,
    Set<String> allowedContentTypes = ApiClient.imageContentTypes,
  }) async {
    final result = await _answer(RecordedCall('DOWNLOAD', path));
    if (result is Uint8List) return result;
    throw StateError('Le handler doit renvoyer des octets pour $path');
  }

  @override
  Future<Object?> delete(String path) => _answer(RecordedCall('DELETE', path));
}

ApiException networkFailure() => const ApiException(
  statusCode: null,
  message: 'Connexion impossible. Vérifiez votre réseau et réessayez.',
);

ApiException problem(
  int status,
  String code,
  String detail, {
  Map<String, List<String>> fieldErrors = const {},
}) => ApiException(
  statusCode: status,
  message: detail,
  code: code,
  fieldErrors: fieldErrors,
);
