import '../../../core/models/address.dart';
import '../../../core/utils/json_reader.dart';

const _unitTypes = {
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

class const OwnerUnit({
  required final String id,
  required final String reference,
  required final String type,
  required final String propertyName,
  required final Address address,
  required final String agencyName,
  final int? floor,
  final int? surfaceHundredths,
  final DateTime? coveredFrom,
  final DateTime? coveredUntil,
}) {
  factory OwnerUnit.fromJson(Map<String, Object?> json) {
    final property = Json.child(json, 'property');
    return OwnerUnit(
      id: Json.string(json, 'id'),
      reference: Json.string(json, 'reference'),
      type: Json.string(json, 'type'),
      propertyName: Json.string(property, 'name'),
      address: Address.fromJson(Json.child(property, 'address')),
      agencyName:
          Json.stringOrNull(Json.child(json, 'agency'), 'name') ?? 'Agence',
      floor: Json.integerOrNull(json, 'floor'),
      surfaceHundredths: Json.integerOrNull(json, 'surface_hundredths'),
      coveredFrom: json['covered_from'] == null
          ? null
          : DateTime.tryParse(Json.string(json, 'covered_from')),
      coveredUntil: json['covered_until'] == null
          ? null
          : DateTime.tryParse(Json.string(json, 'covered_until')),
    );
  }

  String get typeLabel => _unitTypes[type] ?? type;
}
