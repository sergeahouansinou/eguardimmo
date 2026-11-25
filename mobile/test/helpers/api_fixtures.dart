import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:eguardimmo/core/services/api_client.dart';
import 'package:eguardimmo/core/services/api_exception.dart';

/// Réponses de l'API sous test/fixtures/api : copies des réponses réelles
/// capturées sur le backend (chemin relatif, sans extension).
Object? apiFixture(String name) =>
    jsonDecode(File('test/fixtures/api/$name.json').readAsStringSync());

Map<String, Object?> apiObject(String name) =>
    apiFixture(name)! as Map<String, Object?>;

/// Erreur telle que l'application la reçoit : la réponse problème réelle
/// passe par la conversion du vrai client HTTP.
ApiException apiProblem(String name, {required int status}) {
  final options = RequestOptions(path: '/');
  return ApiClient.toApiException(
    DioException(
      requestOptions: options,
      response: Response<Object?>(
        requestOptions: options,
        statusCode: status,
        data: apiFixture(name),
      ),
    ),
  );
}
