import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'app_routes.dart';

/// Tout lien entrant (lien profond, route inconnue) passe ici : seuls les
/// chemins connus et aux paramètres bien formés sont acceptés, le reste mène
/// à l'accueil. Aucune URL ni aucun schéma reçu n'est suivi tel quel.
abstract final class DeepLinkGuard() {
  static final RegExp _listingRef = RegExp(r'^[a-z2-9]{12}$');
  static const _tabs = {
    AppRoutes.explore,
    AppRoutes.stays,
    AppRoutes.messages,
    AppRoutes.account,
    AppRoutes.login,
  };
  static const _profileSlugs = {'locataire', 'proprietaire', 'agence'};
  static const _profileSections = {
    'locataire': {'loyers', 'demandes', 'documents'},
    'proprietaire': {'reversements', 'releve', 'biens', 'documents'},
    'agence': {'impayes', 'interventions', 'portefeuille'},
  };
  static final RegExp _resourceId = RegExp(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
  );

  static bool isAllowed(Uri uri) {
    final segments = uri.pathSegments;
    if (_tabs.contains(uri.path)) return true;
    if (segments.length == 2 && segments.first == 'annonces') {
      return _listingRef.hasMatch(segments[1]);
    }
    if (segments.length == 2 && segments.first == 'profil') {
      return _profileSlugs.contains(segments[1]);
    }
    if (segments.length >= 3 &&
        segments.length <= 4 &&
        segments.first == 'profil') {
      return _isProfileSection(segments);
    }
    if (segments.isNotEmpty && segments.first == 'messages') {
      return _isMessagesRoute(segments);
    }
    return false;
  }

  static bool _isMessagesRoute(List<String> segments) {
    if (segments.length == 2) return segments[1] == 'support';
    if (segments.length != 3) return false;
    final section = segments[1];
    if (section != 'conversations' && section != 'support') return false;
    return segments[2] == 'nouvelle' || _resourceId.hasMatch(segments[2]);
  }

  static bool _isProfileSection(List<String> segments) {
    final sections = _profileSections[segments[1]];
    if (sections == null || !sections.contains(segments[2])) return false;
    if (segments.length == 3) return true;
    final id = segments[3];
    return switch (segments[2]) {
      'loyers' => _resourceId.hasMatch(id),
      'demandes' => id == 'nouvelle' || _resourceId.hasMatch(id),
      'interventions' => _resourceId.hasMatch(id),
      _ => false,
    };
  }

  static String? redirect(BuildContext context, GoRouterState state) =>
      isAllowed(state.uri) ? null : AppRoutes.explore;
}
