import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

class const StubResponse(
  final int status, [
  final Object? body,
  final String contentType = 'application/json',
  final Map<String, List<String>> headers = const {},
]) {}

class StubAdapter(final StubResponse Function(RequestOptions options) handler)
    implements HttpClientAdapter {
  final List<RequestOptions> requests = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    final response = handler(options);
    return ResponseBody.fromString(
      response.body == null ? '' : jsonEncode(response.body),
      response.status,
      headers: {
        Headers.contentTypeHeader: [response.contentType],
        ...response.headers,
      },
    );
  }

  @override
  void close({bool force = false}) {}
}
