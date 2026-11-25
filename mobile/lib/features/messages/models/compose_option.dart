import '../../../core/utils/json_reader.dart';

/// Bail sur lequel le locataire peut écrire (`GET /tenant/conversations/options`).
class const ComposeOption({
  required final String leaseId,
  required final String? agencyName,
  required final String? leaseReference,
}) {
  factory ComposeOption.fromJson(Map<String, Object?> json) {
    final lease = Json.child(json, 'lease');
    return ComposeOption(
      leaseId: Json.string(lease, 'id'),
      agencyName: Json.stringOrNull(Json.child(json, 'agency'), 'name'),
      leaseReference: Json.stringOrNull(lease, 'reference'),
    );
  }

  @override
  bool operator ==(Object other) =>
      other is ComposeOption && other.leaseId == leaseId;

  @override
  int get hashCode => leaseId.hashCode;

  String get label {
    final reference = leaseReference == null ? 'Bail' : 'Bail $leaseReference';
    return agencyName == null ? reference : '$reference · $agencyName';
  }
}
