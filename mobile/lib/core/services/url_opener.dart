import 'package:url_launcher/url_launcher.dart';

import 'app_logger.dart';

/// Ouvre un lien externe. Seuls https et mailto sont permis : jamais une URL
/// reçue de l'API ou d'un lien profond sans cette liste blanche.
class const UrlOpener({final AppLogger logger = const AppLogger()}) {
  static const _allowedSchemes = {'https', 'mailto'};

  Future<bool> open(Uri uri) async {
    if (!_allowedSchemes.contains(uri.scheme)) {
      logger.warning('Schéma refusé : ${uri.scheme}');
      return false;
    }
    try {
      return await launchUrl(uri, mode: LaunchMode.externalApplication);
    } on Exception catch (error, stack) {
      logger.error('Ouverture du lien impossible', error: error, stack: stack);
      return false;
    }
  }
}
