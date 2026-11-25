enum TicketStatus(final String wire, final String label) {
  open('open', 'Ouverte'),
  waiting('waiting', 'Réponse du support'),
  resolved('resolved', 'Résolue');

  static TicketStatus parse(String value) => values.firstWhere(
    (status) => status.wire == value,
    orElse: () => throw FormatException('« status » inconnu : $value'),
  );
}

enum TicketCategory(final String wire, final String label) {
  messaging('messaging', 'Messagerie'),
  billing('billing', 'Facturation'),
  account('account', 'Compte'),
  documents('documents', 'Documents'),
  other('other', 'Autre');

  static TicketCategory parse(String value) => values.firstWhere(
    (category) => category.wire == value,
    orElse: () => throw FormatException('« category » inconnue : $value'),
  );
}
