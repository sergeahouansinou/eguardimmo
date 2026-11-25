import '../../../core/utils/json_reader.dart';

const _documentKinds = {
  'mandate': 'Mandat signé',
  'amendment': 'Avenant',
  'diagnostic': 'Diagnostic',
  'insurance': 'Assurance',
  'other': 'Autre document',
};

class const OwnerDocument({
  required final String id,
  required final String kind,
  required final bool byAgency,
  required final String agencyName,
  final String? name,
  final int? sizeBytes,
  final DateTime? sharedAt,
  final String? mandateReference,
}) {
  factory OwnerDocument.fromJson(Map<String, Object?> json) => OwnerDocument(
    id: Json.string(json, 'id'),
    kind: Json.string(json, 'kind'),
    byAgency: Json.string(json, 'uploaded_by') == 'agency',
    agencyName:
        Json.stringOrNull(Json.child(json, 'agency'), 'name') ?? 'Agence',
    name: Json.stringOrNull(json, 'name'),
    sizeBytes: Json.integerOrNull(json, 'size_bytes'),
    sharedAt: Json.dateOrNull(json, 'shared_at'),
    mandateReference: _mandateReference(json),
  );

  static String? _mandateReference(Map<String, Object?> json) {
    final mandate = Json.childOrNull(json, 'mandate');
    return mandate == null ? null : Json.stringOrNull(mandate, 'reference');
  }

  String get kindLabel => _documentKinds[kind] ?? 'Document';
}
