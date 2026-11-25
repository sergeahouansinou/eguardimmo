import '../../../core/models/money.dart';
import '../../../core/utils/json_reader.dart';
import 'agency_intervention.dart';
import 'intervention_parts.dart';

enum Responsibility(final String label, final String key) {
  owner('Propriétaire', 'owner'),
  tenant('Locataire', 'tenant'),
  shared('Partagée', 'shared'),
  undetermined('À déterminer', 'undetermined');

  static Responsibility parse(String value) => values.firstWhere(
    (responsibility) => responsibility.key == value,
    orElse: () => throw FormatException('Responsabilité inconnue : $value'),
  );
}

class const InterventionDetail({
  required final AgencyIntervention summary,
  required final String description,
  required final Responsibility responsibility,
  required final int lockVersion,
  required final Money committed,
  required final List<InterventionEvent> events,
  required final List<InterventionQuote> quotes,
  required final List<InterventionApproval> approvals,
  required final List<InterventionFile> files,
  final String? reporterName,
  final String? supplierPartyId,
  final Money? ceiling,
  final DateTime? dueOn,
  final String? declineNote,
}) {
  factory InterventionDetail.fromJson(Map<String, Object?> json) {
    final reporter = Json.childOrNull(json, 'reporter');
    final supplier = Json.childOrNull(json, 'supplier');
    return InterventionDetail(
      summary: AgencyIntervention.fromJson(json),
      description: Json.string(json, 'description'),
      responsibility: Responsibility.parse(Json.string(json, 'responsibility')),
      lockVersion: Json.integer(json, 'lock_version'),
      committed: Money.fromJson(json, 'committed_amount'),
      reporterName: reporter == null
          ? null
          : Json.stringOrNull(reporter, 'name'),
      supplierPartyId: supplier == null ? null : Json.string(supplier, 'id'),
      ceiling: Money.fromJsonOrNull(json, 'ceiling_amount'),
      dueOn: json['due_on'] == null ? null : Json.day(json, 'due_on'),
      declineNote: Json.stringOrNull(json, 'decline_note'),
      events: _all(json, 'events', InterventionEvent.fromJson),
      quotes: _all(json, 'quotes', InterventionQuote.fromJson),
      approvals: _all(json, 'approvals', InterventionApproval.fromJson),
      files: _all(json, 'files', InterventionFile.fromJson),
    );
  }

  static List<T> _all<T>(
    Map<String, Object?> json,
    String key,
    T Function(Map<String, Object?> entry) read,
  ) => [
    for (final entry in Json.list(json[key], key))
      read(Json.object(entry, key)),
  ];

  String get id => summary.id;

  InterventionStatus get status => summary.status;

  InterventionPriority get priority => summary.priority;

  /// Pièces écrites déjà rattachées à une décision : le serveur refuse de les
  /// réutiliser pour une autre.
  List<InterventionFile> get availableProofs {
    final used = {for (final approval in approvals) ?approval.proofFileId};
    return [
      for (final file in files)
        if (file.isProof && !used.contains(file.id)) file,
    ];
  }
}

class const Supplier({
  required final String partyId,
  required final String name,
  required final bool preferred,
}) {
  factory Supplier.fromJson(Map<String, Object?> json) {
    final party = Json.child(json, 'party');
    return Supplier(
      partyId: Json.string(party, 'id'),
      name: Json.stringOrNull(party, 'name') ?? 'Prestataire sans nom',
      preferred: Json.boolean(json, 'preferred'),
    );
  }
}
