import '../../../core/models/money.dart';
import '../../../core/utils/json_reader.dart';

enum QuoteStatus(final String label, final String key) {
  received('Reçu', 'received'),
  submitted('Soumis', 'submitted'),
  accepted('Accepté', 'accepted'),
  refused('Refusé', 'refused'),
  expired('Expiré', 'expired'),
  superseded('Remplacé', 'superseded');

  static QuoteStatus parse(String value) => values.firstWhere(
    (status) => status.key == value,
    orElse: () => throw FormatException('Statut de devis inconnu : $value'),
  );

  bool get acceptable => this == received || this == submitted;
}

enum ApprovalStatus(final String label, final String key) {
  pending('En attente', 'pending'),
  accepted('Accordée', 'accepted'),
  refused('Refusée', 'refused'),
  question('Question posée', 'question'),
  expired('Expirée', 'expired'),
  withdrawn('Retirée', 'withdrawn');

  static ApprovalStatus parse(String value) => values.firstWhere(
    (status) => status.key == value,
    orElse: () =>
        throw FormatException('Statut de demande d’accord inconnu : $value'),
  );

  bool get isOpen => this == pending || this == question;
}

class const InterventionQuote({
  required final String id,
  required final String reference,
  required final QuoteStatus status,
  required final DateTime issuedOn,
  required final Money totalGross,
  final DateTime? validUntil,
  final String? message,
}) {
  factory InterventionQuote.fromJson(Map<String, Object?> json) =>
      InterventionQuote(
        id: Json.string(json, 'id'),
        reference: Json.string(json, 'reference'),
        status: QuoteStatus.parse(Json.string(json, 'status')),
        issuedOn: Json.day(json, 'issued_on'),
        validUntil: json['valid_until'] == null
            ? null
            : Json.day(json, 'valid_until'),
        message: Json.stringOrNull(json, 'message'),
        totalGross: Money.fromJson(json, 'total_gross'),
      );
}

class const InterventionApproval({
  required final String id,
  required final ApprovalStatus status,
  required final Money amount,
  required final Money ceiling,
  required final DateTime decideBefore,
  final String? quoteId,
  final DateTime? decidedAt,
  final String? comment,
  final String? proofFileId,
}) {
  factory InterventionApproval.fromJson(Map<String, Object?> json) =>
      InterventionApproval(
        id: Json.string(json, 'id'),
        quoteId: Json.stringOrNull(json, 'quote_id'),
        status: ApprovalStatus.parse(Json.string(json, 'status')),
        amount: Money.fromJson(json, 'amount'),
        ceiling: Money.fromJson(json, 'ceiling_amount'),
        decideBefore: Json.date(json, 'decide_before'),
        decidedAt: Json.dateOrNull(json, 'decided_at'),
        comment: Json.stringOrNull(json, 'comment'),
        proofFileId: Json.stringOrNull(json, 'proof_file_id'),
      );
}

enum EventActor(final String label, final String key) {
  team('Équipe', 'team'),
  owner('Propriétaire', 'owner'),
  tenant('Locataire', 'tenant'),
  system('Système', 'system');

  static EventActor parse(String value) => values.firstWhere(
    (actor) => actor.key == value,
    orElse: () => throw FormatException('Acteur inconnu : $value'),
  );
}

class const InterventionEvent({
  required final String id,
  required final EventActor actor,
  required final String text,
  required final DateTime createdAt,
  required final bool visibleToOwner,
  required final bool visibleToTenant,
}) {
  factory InterventionEvent.fromJson(Map<String, Object?> json) =>
      InterventionEvent(
        id: Json.string(json, 'id'),
        actor: EventActor.parse(Json.string(json, 'actor_kind')),
        text: Json.string(json, 'text'),
        createdAt: Json.date(json, 'created_at'),
        visibleToOwner: Json.boolean(json, 'visible_to_owner'),
        visibleToTenant: Json.boolean(json, 'visible_to_tenant'),
      );
}

class const InterventionFile({
  required final String id,
  required final String kind,
  final DateTime? createdAt,
}) {
  static const proofKind = 'proof';

  factory InterventionFile.fromJson(Map<String, Object?> json) =>
      InterventionFile(
        id: Json.string(json, 'id'),
        kind: Json.string(json, 'kind'),
        createdAt: Json.dateOrNull(json, 'created_at'),
      );

  bool get isProof => kind == proofKind;
}
