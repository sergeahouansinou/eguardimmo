import '../../../core/utils/json_reader.dart';

String ownerRoleLabel(String role) => switch (role) {
  'holder' => 'Titulaire du mandat',
  'representative' => 'Représentant du titulaire',
  'co_owner' => 'Co-indivisaire (lecture seule)',
  _ => 'Propriétaire',
};

class const OwnerAccess({
  required final String accessId,
  required final String role,
  required final String agencyId,
  required final String agencyName,
  required final String mandantName,
  required final bool inGrace,
  required final bool readOnly,
  final DateTime? accessUntil,
}) {
  factory OwnerAccess.fromJson(Map<String, Object?> json) {
    final agency = Json.child(json, 'agency');
    return OwnerAccess(
      accessId: Json.string(json, 'access_id'),
      role: Json.string(json, 'role'),
      agencyId: Json.string(agency, 'id'),
      agencyName: Json.stringOrNull(agency, 'name') ?? 'Agence',
      mandantName: Json.stringOrNull(Json.child(json, 'mandant'), 'name') ?? '',
      inGrace: Json.boolean(json, 'in_grace'),
      readOnly: Json.boolean(json, 'read_only'),
      accessUntil: json['access_until'] == null
          ? null
          : Json.day(json, 'access_until'),
    );
  }

  String get label => '$agencyName · $mandantName';
}
