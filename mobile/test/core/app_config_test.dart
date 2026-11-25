import 'package:eguardimmo/core/config/app_config.dart';
import 'package:flutter_test/flutter_test.dart';

const pinA = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
const pinB = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=';

AppConfig config({
  String environmentName = 'prod',
  String apiBaseUrl = 'https://api.example.fr/api/v1',
  bool apiBaseUrlProvided = true,
  String termsUrl = 'https://example.fr/cgu',
  String privacyUrl = 'https://example.fr/confidentialite',
  String supportEmail = 'contact@example.fr',
  String apiPinsRaw = '$pinA,$pinB',
}) => AppConfig(
  environmentName: environmentName,
  apiBaseUrl: apiBaseUrl,
  apiBaseUrlProvided: apiBaseUrlProvided,
  termsUrl: termsUrl,
  privacyUrl: privacyUrl,
  supportEmail: supportEmail,
  appVersion: '1.0.0',
  apiPinsRaw: apiPinsRaw,
);

void main() {
  test('une configuration prod complète est valide', () {
    expect(config().validate(), isEmpty);
  });

  test('la configuration par défaut du poste de dev est valide', () {
    expect(AppConfig.current.validate(), isEmpty);
    expect(AppConfig.current.pinningEnabled(), isFalse);
  });

  test('un environnement inconnu est refusé', () {
    expect(config(environmentName: 'production').validate(), hasLength(1));
  });

  test('hors dev, l’API doit être fournie explicitement et en HTTPS', () {
    final problems = config(
      apiBaseUrl: 'http://localhost:3000/v1',
      apiBaseUrlProvided: false,
    ).validate();
    expect(problems, hasLength(2));
    expect(problems.join(), contains('obligatoire'));
    expect(problems.join(), contains('HTTPS'));
  });

  test('en release, le clair est refusé même en dev', () {
    final problems = config(
      environmentName: 'dev',
      apiBaseUrl: 'http://10.0.2.2:8000/api/v1',
    ).validate(debugMode: false);
    expect(problems.where((p) => p.contains('HTTPS')), hasLength(1));
  });

  test('en profile (debug coupé), même ENV=dev : http refusé', () {
    final dev = config(
      environmentName: 'dev',
      apiBaseUrl: 'http://10.0.2.2:8000/api/v1',
    );
    expect(dev.requiresHttps(debugMode: false), isTrue);
    expect(dev.validate(debugMode: false).join(), contains('HTTPS'));
  });

  test('en debug avec ENV=staging ou prod : http refusé aussi', () {
    final staging = config(
      environmentName: 'staging',
      apiBaseUrl: 'http://10.0.2.2:8000/api/v1',
    );
    expect(staging.requiresHttps(), isTrue);
    expect(staging.validate().join(), contains('HTTPS'));
  });

  test('journaux : coupés dès qu’on n’est pas en debug ou hors ENV=dev', () {
    final dev = config(environmentName: 'dev');
    expect(dev.logsEnabled(), isTrue);
    expect(dev.logsEnabled(debugMode: false), isFalse);
    expect(config(environmentName: 'staging').logsEnabled(), isFalse);
    expect(config(environmentName: 'prod').logsEnabled(), isFalse);
    expect(config(environmentName: 'inconnu').logsEnabled(), isFalse);
  });

  group('épinglage de certificat', () {
    test('liste lue depuis API_PINS, espaces et vides ignorés', () {
      expect(config(apiPinsRaw: ' $pinA , ,$pinB,').apiPins, [pinA, pinB]);
    });

    test('désactivé en dev debug, même sans empreinte', () {
      final dev = config(environmentName: 'dev', apiPinsRaw: '');
      expect(dev.pinningEnabled(), isFalse);
      expect(dev.validate(), isEmpty);
    });

    test('hors dev, une empreinte seule est refusée (courante et secours)', () {
      final problems = config(apiPinsRaw: pinA).validate();
      expect(problems.single, contains('au moins 2'));
    });

    test('hors dev, l’absence d’empreinte refuse le démarrage', () {
      for (final env in ['staging', 'prod']) {
        final problems = config(
          environmentName: env,
          apiPinsRaw: '',
        ).validate();
        expect(problems.join(), contains('API_PINS'), reason: env);
      }
    });

    test('en release avec ENV=dev, les empreintes sont obligatoires', () {
      final problems = config(
        environmentName: 'dev',
        apiPinsRaw: '',
      ).validate(debugMode: false);
      expect(problems.join(), contains('API_PINS'));
    });

    test('deux fois la même empreinte ne compte que pour une', () {
      expect(
        config(apiPinsRaw: '$pinA,$pinA').validate().join(),
        contains('au moins 2'),
      );
    });

    test('les valeurs de remplacement de example.json sont refusées', () {
      final problems = config(
        apiPinsRaw: '[À RENSEIGNER] pin SPKI courant,[À RENSEIGNER] pin SPKI de secours',
      ).validate();
      expect(problems.join(), contains('empreinte invalide'));
    });

    test('une empreinte mal formée est refusée', () {
      expect(
        config(apiPinsRaw: '$pinA,pas-une-empreinte').validate().join(),
        contains('empreinte invalide'),
      );
    });
  });

  test('en dev hors release, le trafic en clair est toléré', () {
    expect(
      config(
        environmentName: 'dev',
        apiBaseUrl: 'http://10.0.2.2:3300/v1',
      ).validate(),
      isEmpty,
    );
  });

  test('une URL sans hôte ou relative est refusée', () {
    expect(config(termsUrl: '/cgu').validate(), hasLength(1));
    expect(config(privacyUrl: 'https://').validate(), hasLength(1));
  });

  test('un e-mail invalide est refusé', () {
    expect(config(supportEmail: 'pas-un-mail').validate(), hasLength(1));
  });

  test('chaque problème est signalé séparément', () {
    final problems = config(
      environmentName: 'x',
      termsUrl: 'cgu',
      privacyUrl: 'cgu',
      supportEmail: 'x',
    ).validate();
    expect(problems.length, greaterThanOrEqualTo(4));
  });
}
