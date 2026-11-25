import '../../../core/utils/json_reader.dart';

class const LeaseDocument({
  required final String id,
  required final String kind,
  final DateTime? sharedAt,
  final String? fileName,
  final int? sizeBytes,
}) {
  static const _kinds = {
    'amendment': 'Avenant',
    'diagnostic': 'Diagnostic',
    'letter': 'Courrier',
    'attestation': 'Attestation',
    'other': 'Autre document',
  };

  factory LeaseDocument.fromJson(Map<String, Object?> json) {
    final file = Json.childOrNull(json, 'file');
    return LeaseDocument(
      id: Json.string(json, 'id'),
      kind: Json.string(json, 'kind'),
      sharedAt: Json.dateOrNull(json, 'shared_at'),
      fileName: file == null ? null : Json.string(file, 'name'),
      sizeBytes: file == null ? null : Json.integer(file, 'size_bytes'),
    );
  }

  String get kindLabel => _kinds[kind] ?? 'Document';
}

class const LeaseDocuments({
  required final String leaseReference,
  required final List<LeaseDocument> documents,
}) {}
