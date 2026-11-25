enum ProfileKind(final String title, final String slug) {
  traveler('Voyageur', 'voyageur'),
  tenant('Locataire', 'locataire'),
  owner('Propriétaire', 'proprietaire'),
  agency('Agence', 'agence');

  static ProfileKind? fromSlug(String slug) {
    for (final kind in values) {
      if (kind.slug == slug) return kind;
    }
    return null;
  }
}

class const AppProfile({
  required final String id,
  required final ProfileKind kind,
  required final String label,
  final String? organization,
}) {
  static const traveler = AppProfile(
    id: 'traveler',
    kind: ProfileKind.traveler,
    label: 'Voyageur',
  );
}
