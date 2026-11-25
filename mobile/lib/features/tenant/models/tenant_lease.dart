import '../../../core/models/address.dart';
import '../../../core/utils/json_reader.dart';

enum LeasePhase(final String label) {
  upcoming('À venir'),
  running('En cours'),
  notice('Congé donné'),
  ended('Terminé');

  static LeasePhase parse(String value) => switch (value) {
    'upcoming' => upcoming,
    'running' => running,
    'notice' => notice,
    'ended' => ended,
    _ => throw FormatException('Phase de bail inconnue : $value'),
  };
}

class const LeaseUnit({
  required final String reference,
  required final String type,
  required final String propertyName,
  required final Address address,
  final int? floor,
  final int? surfaceHundredths,
}) {
  static const _types = {
    'apartment': 'Appartement',
    'studio': 'Studio',
    'house': 'Maison',
    'parking': 'Parking',
    'garage': 'Garage',
    'cellar': 'Cave',
    'commercial_premises': 'Local commercial',
    'office': 'Bureau',
    'land': 'Terrain',
  };

  factory LeaseUnit.fromJson(Map<String, Object?> json) {
    final property = Json.child(json, 'property');
    return LeaseUnit(
      reference: Json.string(json, 'reference'),
      type: Json.string(json, 'type'),
      propertyName: Json.string(property, 'name'),
      address: Address.fromJson(Json.child(property, 'address')),
      floor: Json.integerOrNull(json, 'floor'),
      surfaceHundredths: Json.integerOrNull(json, 'surface_hundredths'),
    );
  }

  String get typeLabel => _types[type] ?? type;
}

class const TenantLease({
  required final String id,
  required final String reference,
  required final LeasePhase phase,
  required final DateTime startsOn,
  required final String agencyName,
  final DateTime? endDate,
  final LeaseUnit? mainUnit,
}) {
  factory TenantLease.fromJson(Map<String, Object?> json) {
    final unit = Json.childOrNull(json, 'main_unit');
    return TenantLease(
      id: Json.string(json, 'id'),
      reference: Json.string(json, 'reference'),
      phase: LeasePhase.parse(Json.string(json, 'phase')),
      startsOn: Json.day(json, 'starts_on'),
      endDate: json['end_date'] == null ? null : Json.day(json, 'end_date'),
      agencyName:
          Json.stringOrNull(Json.child(json, 'organization'), 'name') ??
          'Agence',
      mainUnit: unit == null ? null : LeaseUnit.fromJson(unit),
    );
  }
}
