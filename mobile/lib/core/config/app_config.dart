import 'package:flutter/foundation.dart';

enum AppEnvironment() {
  dev,
  staging,
  prod;

  static AppEnvironment? parse(String value) {
    for (final environment in values) {
      if (environment.name == value) return environment;
    }
    return null;
  }
}

/// Unique point d'entrée de la configuration : tout lien externe, adresse,
/// identifiant public ou réglage qui peut changer vit ici et dans env/*.json.
/// Les valeurs sont compilées dans le binaire : jamais de secret.
class const AppConfig({
  required final String environmentName,
  required final String apiBaseUrl,
  required final bool apiBaseUrlProvided,
  required final String termsUrl,
  required final String privacyUrl,
  required final String supportEmail,
  required final String appVersion,
  final String apiPinsRaw = '',
}) {
  static const AppConfig current = AppConfig(
    environmentName: String.fromEnvironment('ENV', defaultValue: 'dev'),
    apiBaseUrl: String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: 'http://localhost:8000/api/v1',
    ),
    apiBaseUrlProvided: bool.hasEnvironment('API_BASE_URL'),
    termsUrl: String.fromEnvironment(
      'TERMS_URL',
      defaultValue: 'https://example.com/conditions',
    ),
    privacyUrl: String.fromEnvironment(
      'PRIVACY_URL',
      defaultValue: 'https://example.com/confidentialite',
    ),
    supportEmail: String.fromEnvironment(
      'SUPPORT_EMAIL',
      defaultValue: 'support@example.com',
    ),
    appVersion: String.fromEnvironment('APP_VERSION', defaultValue: '1.0.0'),
    apiPinsRaw: String.fromEnvironment('API_PINS'),
  );

  /// Empreintes SPKI SHA-256 (base64) acceptées pour l'API : courante puis
  /// secours. `dart-define-from-file` ne transporte que des textes : liste
  /// séparée par des virgules.
  static final RegExp pinPattern = RegExp(r'^[A-Za-z0-9+/]{43}=$');
  static const minimumPins = 2;

  AppEnvironment? get environment => AppEnvironment.parse(environmentName);
  bool get isProd => environment == AppEnvironment.prod;

  List<String> get apiPins => [
    for (final pin in apiPinsRaw.split(','))
      if (pin.trim().isNotEmpty) pin.trim(),
  ];

  /// Durci dès qu'on n'est pas en debug OU que `ENV` n'est pas `dev` : un
  /// build profile ou release ne se comporte jamais comme un poste de dev.
  bool isHardened({bool debugMode = kDebugMode}) =>
      !debugMode || environment != AppEnvironment.dev;

  bool requiresHttps({bool debugMode = kDebugMode}) =>
      isHardened(debugMode: debugMode);

  bool pinningEnabled({bool debugMode = kDebugMode}) =>
      isHardened(debugMode: debugMode);

  bool logsEnabled({bool debugMode = kDebugMode}) =>
      !isHardened(debugMode: debugMode);

  List<String> validate({bool debugMode = kDebugMode}) {
    final problems = <String>[];
    final environment = this.environment;
    if (environment == null) {
      problems.add(
        'ENV « $environmentName » inconnu (attendu : dev, staging ou prod).',
      );
    }
    if (environment != AppEnvironment.dev && !apiBaseUrlProvided) {
      problems.add('API_BASE_URL est obligatoire hors dev.');
    }
    final strict = requiresHttps(debugMode: debugMode);
    final urls = {
      'API_BASE_URL': apiBaseUrl,
      'TERMS_URL': termsUrl,
      'PRIVACY_URL': privacyUrl,
    };
    for (final MapEntry(:key, :value) in urls.entries) {
      final uri = Uri.tryParse(value);
      if (uri == null || !uri.isAbsolute || uri.host.isEmpty) {
        problems.add('$key n’est pas une URL absolue valide.');
      } else if (strict && uri.scheme != 'https') {
        problems.add('$key doit être en HTTPS (hors debug).');
      }
    }
    if (!_emailPattern.hasMatch(supportEmail)) {
      problems.add('SUPPORT_EMAIL n’est pas une adresse e-mail valide.');
    }
    if (pinningEnabled(debugMode: debugMode)) {
      problems.addAll(_pinProblems());
    }
    return problems;
  }

  List<String> _pinProblems() {
    final pins = apiPins;
    final problems = <String>[];
    for (final pin in pins) {
      if (!pinPattern.hasMatch(pin)) {
        problems.add(
          'API_PINS contient une empreinte invalide : « $pin » (SHA-256 du SPKI en base64, 44 caractères).',
        );
      }
    }
    if (pins.toSet().length < minimumPins) {
      problems.add(
        'API_PINS : au moins $minimumPins empreintes distinctes (courante et secours) sont obligatoires hors dev.',
      );
    }
    return problems;
  }

  static final RegExp _emailPattern = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
}
