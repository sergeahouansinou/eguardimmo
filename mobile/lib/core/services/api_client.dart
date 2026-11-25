import 'dart:async';
import 'dart:convert';
import 'dart:io' show HttpDate, HttpException;
import 'dart:typed_data';

import 'package:dio/dio.dart';

import 'api_exception.dart';
import 'file_rejected_exception.dart';
import 'token_storage.dart';

typedef SessionExpiredCallback = void Function();

class ApiClient({
  required String baseUrl,
  required final TokenStorage _tokenStorage,
  bool requireHttps = true,
  Dio? dio,
}) {
  this : _dio = dio ?? Dio() {
    final uri = Uri.parse(baseUrl);
    if (requireHttps && uri.scheme != 'https') {
      throw StateError('L’API doit être jointe en HTTPS : $baseUrl');
    }
    _dio.options = BaseOptions(
      baseUrl: baseUrl.endsWith('/')
          ? baseUrl.substring(0, baseUrl.length - 1)
          : baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 15),
      followRedirects: false,
      headers: {'Accept': 'application/json'},
    );
    _dio.interceptors.add(InterceptorsWrapper(onRequest: _attachToken));
  }

  static const defaultMaxDownloadBytes = 10 * 1024 * 1024;
  static const imageContentTypes = {'image/jpeg', 'image/png', 'image/webp'};
  static const _tooLarge = 'Ce fichier est trop volumineux pour être ouvert.';
  static const _skipAuthFlag = 'skip_auth';
  static const _sentTokenKey = 'sent_token';

  final Dio _dio;
  SessionExpiredCallback? onSessionExpired;

  Future<Object?> get(
    String path, {
    Map<String, Object?>? query,
    CancelToken? cancelToken,
  }) => _send('GET', path, query: query, cancelToken: cancelToken);

  Future<Object?> post(
    String path, {
    Object? body,
    bool authenticated = true,
    Map<String, String>? headers,
  }) => _send(
    'POST',
    path,
    body: body,
    authenticated: authenticated,
    headers: headers,
  );

  Future<Object?> put(String path, {Object? body}) =>
      _send('PUT', path, body: body);

  Future<Object?> patch(String path, {Object? body}) =>
      _send('PATCH', path, body: body);

  /// Téléchargement authentifié d'un fichier : les octets ne sont jamais
  /// écrits sur disque ni exécutés ; une erreur du serveur reste un
  /// ApiException lisible. La réception est annulée dès que [maxBytes] est
  /// dépassé (taille annoncée ou réellement reçue) et un Content-Type hors de
  /// [allowedContentTypes] est refusé (FileRejectedException).
  Future<Uint8List> download(
    String path, {
    int maxBytes = defaultMaxDownloadBytes,
    Set<String> allowedContentTypes = imageContentTypes,
  }) async {
    final cancel = CancelToken();
    var tooLarge = false;
    try {
      final response = await _dio.request<Object?>(
        path,
        cancelToken: cancel,
        onReceiveProgress: (received, total) {
          if (received > maxBytes || total > maxBytes) {
            tooLarge = true;
            cancel.cancel();
          }
        },
        options: Options(
          method: 'GET',
          responseType: ResponseType.bytes,
          extra: const {_skipAuthFlag: false},
        ),
      );
      final type = (response.headers.value(Headers.contentTypeHeader) ?? '')
          .split(';')
          .first
          .trim()
          .toLowerCase();
      if (!allowedContentTypes.contains(type)) {
        throw const FileRejectedException(
          'Ce type de fichier ne peut pas être ouvert dans l’application.',
        );
      }
      final data = response.data;
      if (data is! List<int>) {
        throw const FormatException('Fichier : contenu binaire attendu');
      }
      if (data.length > maxBytes) throw const FileRejectedException(_tooLarge);
      return Uint8List.fromList(data);
    } on DioException catch (error) {
      if (tooLarge) throw const FileRejectedException(_tooLarge);
      final failure = toApiException(_decodeErrorBody(error));
      if (failure.isUnauthorized) {
        await _expireSession(error.requestOptions.extra[_sentTokenKey]);
      }
      throw failure;
    }
  }

  static DioException _decodeErrorBody(DioException error) {
    final response = error.response;
    final data = response?.data;
    if (response == null || data is! List<int>) return error;
    try {
      response.data = jsonDecode(utf8.decode(data));
    } on FormatException {
      response.data = null;
    }
    return error;
  }

  Future<Object?> delete(String path) => _send('DELETE', path);

  Future<Object?> _send(
    String method,
    String path, {
    Object? body,
    Map<String, Object?>? query,
    bool authenticated = true,
    Map<String, String>? headers,
    CancelToken? cancelToken,
  }) async {
    try {
      final response = await _dio.request<Object?>(
        path,
        data: body,
        queryParameters: query,
        cancelToken: cancelToken,
        options: Options(
          method: method,
          headers: headers,
          extra: {_skipAuthFlag: !authenticated},
        ),
      );
      return response.data;
    } on DioException catch (error) {
      final failure = toApiException(error);
      if (failure.isUnauthorized && authenticated) {
        await _expireSession(error.requestOptions.extra[_sentTokenKey]);
      }
      throw failure;
    }
  }

  /// Un 401 tardif ne doit pas déconnecter une session ouverte entre-temps :
  /// la session n'expire que si le jeton stocké est celui qui a été envoyé.
  Future<void> _expireSession(Object? sentToken) async {
    final stored = await _tokenStorage.read();
    if (stored == null || stored != sentToken) return;
    await _tokenStorage.clear();
    onSessionExpired?.call();
  }

  Future<void> _attachToken(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    if (options.extra[_skipAuthFlag] != true) {
      final token = await _tokenStorage.read();
      if (token != null) {
        options.headers['Authorization'] = 'Bearer $token';
        options.extra[_sentTokenKey] = token;
      }
    }
    handler.next(options);
  }

  static ApiException toApiException(DioException error) {
    if (error.type == DioExceptionType.cancel) {
      return const ApiException(
        statusCode: null,
        message: 'Requête annulée.',
        cancelled: true,
      );
    }
    final status = error.response?.statusCode;
    if (status == null) {
      return const ApiException(
        statusCode: null,
        message: 'Connexion impossible. Vérifiez votre réseau et réessayez.',
      );
    }
    return _fromProblem(status, error.response?.data, error.response?.headers);
  }

  static ApiException _fromProblem(int status, Object? data, Headers? headers) {
    final body = data is Map<String, Object?>
        ? data
        : const <String, Object?>{};
    final fieldErrors = _fieldErrors(body['errors']);
    final detail = body['detail'];
    final legacy = body['message'];
    final retryAfter =
        _asInt(body['retry_after']) ??
        _retryAfterHeader(headers?.value('retry-after'));
    final firstField = fieldErrors.values
        .expand((messages) => messages)
        .firstOrNull;
    final message =
        firstField ??
        (detail is String && detail.isNotEmpty ? detail : null) ??
        (legacy is String && legacy.isNotEmpty ? legacy : null) ??
        (status >= 500
            ? 'Le service est momentanément indisponible. Réessayez dans un instant.'
            : 'Une erreur est survenue (code $status).');
    return ApiException(
      statusCode: status,
      message: message,
      code: body['code'] is String ? body['code']! as String : null,
      fieldErrors: fieldErrors,
      retryAfterSeconds: retryAfter,
    );
  }

  /// `Retry-After` : nombre de secondes ou date HTTP.
  static int? _retryAfterHeader(String? value) {
    if (value == null) return null;
    final seconds = int.tryParse(value.trim());
    if (seconds != null) return seconds < 0 ? 0 : seconds;
    try {
      final wait = HttpDate.parse(value).difference(DateTime.now().toUtc());
      return wait.isNegative ? 0 : (wait.inMilliseconds / 1000).ceil();
    } on HttpException {
      return null;
    }
  }

  static Map<String, List<String>> _fieldErrors(Object? raw) {
    if (raw is! Map<String, Object?>) return const {};
    return {
      for (final MapEntry(:key, :value) in raw.entries)
        if (value is List<Object?>) key: value.whereType<String>().toList(),
    };
  }

  static int? _asInt(Object? value) => value is int ? value : null;
}
