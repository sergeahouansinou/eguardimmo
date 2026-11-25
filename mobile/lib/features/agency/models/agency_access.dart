import '../../../core/utils/json_reader.dart';

/// Droits de l'utilisateur dans l'organisation, lus dans la matrice servie par
/// `GET /org/{organisation}/roles`. Une indication d'affichage : le serveur
/// applique les droits à chaque requête.
class const AgencyAccess({
  required final String role,
  required final bool maintenanceWrite,
  required final bool recoveryWrite,
}) {
  static const _writeLevels = {'prepare', 'write'};

  factory AgencyAccess.fromJson(Map<String, Object?> json) {
    final role = Json.string(json, 'current_role');
    final levels = <String, String>{};
    for (final entry in Json.list(json['domains'], 'domains')) {
      final domain = Json.object(entry, 'domaine');
      final key = Json.string(domain, 'key');
      if (key != 'maintenance' && key != 'recovery') continue;
      levels[key] = Json.string(Json.child(domain, 'levels'), role);
    }
    return AgencyAccess(
      role: role,
      maintenanceWrite: _writeLevels.contains(levels['maintenance']),
      recoveryWrite: _writeLevels.contains(levels['recovery']),
    );
  }
}
