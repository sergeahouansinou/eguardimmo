import 'app_profile.dart';

enum SpaceKind(final String apiSpace) {
  marketplace('marketplace'),
  tenant('tenant'),
  owner('owner'),
  organization('organization'),
}

/// Espace d'API d'un profil actif : celui que la messagerie et le support
/// déclarent au serveur. Le serveur le revérifie (403 `support_space_forbidden`).
class const ProfileSpace({
  required final SpaceKind kind,
  final String? organizationId,
  final bool agency = false,
}) {
  static const _organizationPrefix = 'org:';

  static const traveler = ProfileSpace(kind: SpaceKind.marketplace);

  factory ProfileSpace.of(AppProfile profile) {
    if (profile.id.startsWith(_organizationPrefix)) {
      return ProfileSpace(
        kind: SpaceKind.organization,
        organizationId: profile.id.substring(_organizationPrefix.length),
        agency: profile.kind == ProfileKind.agency,
      );
    }
    return switch (profile.kind) {
      ProfileKind.tenant => const ProfileSpace(kind: SpaceKind.tenant),
      ProfileKind.owner => const ProfileSpace(kind: SpaceKind.owner),
      ProfileKind.traveler || ProfileKind.agency => traveler,
    };
  }

  String get key => '${kind.apiSpace}:${organizationId ?? ''}';
}
