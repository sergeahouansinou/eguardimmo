enum ListingKind(final String wire) {
  shortStay('short_stay'),
  longTerm('long_term');

  static ListingKind parse(String value) => values.firstWhere(
    (kind) => kind.wire == value,
    orElse: () => throw FormatException('« kind » inconnu : $value'),
  );
}

enum ListingCategory(
  final String wire,
  final String singular,
  final String plural,
) {
  studio('studio', 'Studio', 'Studios'),
  apartment('apartment', 'Appartement', 'Appartements'),
  house('house', 'Maison', 'Maisons'),
  shared('shared', 'Colocation', 'Colocations');

  static ListingCategory parse(String value) => values.firstWhere(
    (category) => category.wire == value,
    orElse: () => throw FormatException('« category » inconnue : $value'),
  );
}

enum PriceUnit(final String wire, final String label) {
  night('night', 'par nuit'),
  month('month', 'par mois');

  static PriceUnit parse(String value) => values.firstWhere(
    (unit) => unit.wire == value,
    orElse: () => throw FormatException('« price_unit » inconnue : $value'),
  );
}

/// Politiques d'annulation : seul le serveur calcule le remboursement.
enum CancellationPolicy(final String wire, final String description) {
  flexible(
    'flexible',
    'Annulation flexible : remboursement intégral jusqu’à 1 jour avant l’arrivée.',
  ),
  moderate(
    'moderate',
    'Annulation modérée : remboursement intégral jusqu’à 5 jours avant l’arrivée.',
  ),
  strict(
    'strict',
    'Annulation stricte : remboursement de 50 % jusqu’à 7 jours avant l’arrivée.',
  );

  static CancellationPolicy parse(String value) => values.firstWhere(
    (policy) => policy.wire == value,
    orElse: () =>
        throw FormatException('« cancellation_policy » inconnue : $value'),
  );
}
