import '../../../core/services/api_client.dart';
import '../../../core/services/app_logger.dart';
import '../../../core/utils/json_reader.dart';
import '../models/app_profile.dart';

class const ProfilesService(
  final ApiClient _api, {
  final AppLogger _logger = const AppLogger(),
}) {
  /// `GET /me/profiles` renvoie `data: [{space, label, meta}]` ; `space` vaut
  /// tenant, owner, organization ou operator. Le profil voyageur n'existe pas
  /// côté serveur : tout compte l'a (ADR 0003). La console n'a pas de mobile.
  Future<List<AppProfile>> fetch() async {
    final entries = Json.dataList(
      await _api.get('/me/profiles'),
      '/me/profiles',
    );
    final profiles = <AppProfile>[AppProfile.traveler];
    for (final entry in entries) {
      final json = Json.object(entry, 'profil');
      final profile = _parse(json);
      if (profile != null) profiles.add(profile);
    }
    return profiles;
  }

  AppProfile? _parse(Map<String, Object?> json) {
    final space = Json.string(json, 'space');
    final label = Json.string(json, 'label');
    switch (space) {
      case 'tenant':
        return AppProfile(id: 'tenant', kind: ProfileKind.tenant, label: label);
      case 'owner':
        return AppProfile(id: 'owner', kind: ProfileKind.owner, label: label);
      case 'organization':
        final meta = Json.child(json, 'meta');
        final organization = Json.string(meta, 'organization');
        final id = 'org:$organization';
        return switch (Json.string(meta, 'kind')) {
          'agency' => AppProfile(
            id: id,
            kind: ProfileKind.agency,
            label: label,
            organization: organization,
          ),
          'individual' => AppProfile(
            id: id,
            kind: ProfileKind.owner,
            label: label,
            organization: organization,
          ),
          final other => _skip('type d’organisation « $other »'),
        };
      case 'operator':
        return null;
      default:
        return _skip('espace « $space »');
    }
  }

  AppProfile? _skip(String what) {
    _logger.warning('Profil ignoré : $what inconnu de l’application mobile');
    return null;
  }
}
