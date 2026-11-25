import 'dart:io';

import 'package:dio/dio.dart';
import 'package:dio/io.dart';

import '../config/app_config.dart';
import 'spki_pin.dart';

/// Règle d'acceptation d'un certificat serveur : hôte de l'API, validité dans
/// le temps et clé publique épinglée.
class CertificatePolicy({
  required final String host,
  required final PinSet pins,
  DateTime Function()? now,
}) {
  this : _now = now ?? DateTime.now;

  final DateTime Function() _now;

  bool accepts(X509Certificate certificate, String requestedHost, int port) {
    if (requestedHost != host) return false;
    final now = _now();
    if (now.isBefore(certificate.startValidity) ||
        now.isAfter(certificate.endValidity)) {
      return false;
    }
    return pins.matches(certificate.der);
  }
}

/// Transport Dio épinglé. Sans racines de confiance, chaque certificat est
/// « douteux » pour dart:io et passe par `badCertificateCallback` : la clé
/// publique de l'API épinglée est alors le seul moyen d'être accepté, la
/// confiance des autorités du système n'entre pas en jeu. Seul le certificat
/// feuille est visible : l'empreinte épinglée est celle de sa clé publique.
abstract final class PinnedTransport() {
  static HttpClient httpClient(CertificatePolicy policy) {
    final client = HttpClient(context: SecurityContext(withTrustedRoots: false))
      ..badCertificateCallback = policy.accepts;
    return client;
  }

  /// Dio épinglé quand la configuration l'exige, Dio standard sinon (dev).
  static Dio dio(AppConfig config) {
    final dio = Dio();
    if (config.pinningEnabled()) {
      final policy = CertificatePolicy(
        host: Uri.parse(config.apiBaseUrl).host,
        pins: PinSet(config.apiPins),
      );
      dio.httpClientAdapter = IOHttpClientAdapter(
        createHttpClient: () => httpClient(policy),
      );
    }
    return dio;
  }
}
