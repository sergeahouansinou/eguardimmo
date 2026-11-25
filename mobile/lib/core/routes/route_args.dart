/// Argument d'une route ouvrant une ressource désignée par son UUID.
class const ResourceArgs(final String id) {
  static final RegExp _uuid = RegExp(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
  );

  bool get isValid => _uuid.hasMatch(id);

  @override
  bool operator ==(Object other) => other is ResourceArgs && other.id == id;

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() => 'ResourceArgs($id)';
}

/// Argument de la fiche d'une annonce : sa référence publique.
class const ListingArgs(final String ref) {
  static final RegExp _ref = RegExp(r'^[a-z2-9]{12}$');

  bool get isValid => _ref.hasMatch(ref);

  @override
  bool operator ==(Object other) => other is ListingArgs && other.ref == ref;

  @override
  int get hashCode => ref.hashCode;

  @override
  String toString() => 'ListingArgs($ref)';
}
