import 'package:eguardimmo/core/services/api_exception.dart';
import 'package:eguardimmo/core/utils/api_error_text.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/api_fixtures.dart';

void main() {
  test('garde le message du serveur pour un refus 403', () {
    final error = apiProblem('support/problem_email_unverified', status: 403);
    expect(
      ApiErrorText.of(error),
      'Confirmez votre adresse e-mail pour accéder à cet espace.',
    );
  });

  test('429 générique : phrase neutre et attente de Retry-After', () {
    final error = apiProblem('messages/problem_rate_limited', status: 429);
    expect(
      ApiErrorText.of(error),
      'Trop de requêtes envoyées. Réessayez dans 42 s.',
    );
  });

  test('429 : l’attente est exprimée en minutes puis en heures', () {
    final error = apiProblem('support/problem_rate_limited', status: 429);
    expect(
      ApiErrorText.of(error),
      'Trop de requêtes envoyées. Réessayez dans 30 min.',
    );
    expect(ApiErrorText.waitLabel(59), '59 s');
    expect(ApiErrorText.waitLabel(61), '2 min');
    expect(ApiErrorText.waitLabel(3601), '2 h');
  });

  test('429 spécifique : garde le message du serveur et ajoute l’attente', () {
    const error = ApiException(
      statusCode: 429,
      message: 'Trop de pièces jointes aujourd’hui',
      code: 'conversation_attachment_limit',
      retryAfterSeconds: 120,
    );
    expect(
      ApiErrorText.of(error),
      'Trop de pièces jointes aujourd’hui. Réessayez dans 2 min.',
    );
  });

  test('429 sans Retry-After : pas d’attente inventée', () {
    const error = ApiException(
      statusCode: 429,
      message: 'Trop de tentatives. Réessayez plus tard.',
      code: 'too_many_requests',
    );
    expect(ApiErrorText.of(error), 'Trop de requêtes envoyées.');
  });
}
