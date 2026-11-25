import 'app_location.dart';
import 'app_routes.dart';
import 'route_args.dart';

/// Tout lien entrant (lien profond, route inconnue) passe ici : seuls les
/// chemins connus et aux paramètres bien formés sont acceptés, le reste mène
/// à l'accueil. Aucune URL ni aucun schéma reçu n'est suivi tel quel.
abstract final class DeepLinkGuard() {
  static const _fixedPaths = {
    RouteName.explore,
    RouteName.stays,
    RouteName.messages,
    RouteName.account,
    RouteName.login,
    RouteName.tenantHome,
    RouteName.tenantRent,
    RouteName.tenantRequests,
    RouteName.tenantNewRequest,
    RouteName.tenantDocuments,
    RouteName.ownerHome,
    RouteName.ownerPayouts,
    RouteName.ownerStatement,
    RouteName.ownerProperties,
    RouteName.ownerDocuments,
    RouteName.agencyHome,
    RouteName.agencyUnpaid,
    RouteName.agencyInterventions,
    RouteName.agencyPortfolio,
    RouteName.newConversation,
    RouteName.support,
    RouteName.newSupportTicket,
  };

  static AppLocation? resolve(Uri uri) {
    if (_fixedPaths.contains(uri.path)) return AppLocation(uri.path);
    return switch (_segments(uri)) {
      ['annonces', final ref] => _listing(ref),
      ['profil', 'locataire', 'loyers', final id] => _resource(
        RouteName.tenantInstallment,
        id,
      ),
      ['profil', 'locataire', 'demandes', final id] => _resource(
        RouteName.tenantRequest,
        id,
      ),
      ['profil', 'agence', 'interventions', final id] => _resource(
        RouteName.agencyIntervention,
        id,
      ),
      ['messages', 'conversations', final id] => _resource(
        RouteName.conversation,
        id,
      ),
      ['messages', 'support', final id] => _resource(
        RouteName.supportTicket,
        id,
      ),
      _ => null,
    };
  }

  static bool isAllowed(Uri uri) => resolve(uri) != null;

  /// `pathSegments` décode à la demande et lève sur un encodage invalide.
  static List<String>? _segments(Uri uri) {
    try {
      return uri.pathSegments;
    } on FormatException {
      return null;
    }
  }

  static AppLocation? _listing(String ref) {
    final args = ListingArgs(ref);
    return args.isValid ? AppLocation(RouteName.listing, args) : null;
  }

  static AppLocation? _resource(String name, String id) {
    final args = ResourceArgs(id);
    return args.isValid ? AppLocation(name, args) : null;
  }
}
