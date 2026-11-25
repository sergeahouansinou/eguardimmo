import '../utils/json_reader.dart';

class const Address({
  required final String line1,
  final String? line2,
  required final String postalCode,
  required final String city,
}) {
  factory Address.fromJson(Map<String, Object?> json) => Address(
    line1: Json.string(json, 'line1'),
    line2: Json.stringOrNull(json, 'line2'),
    postalCode: Json.string(json, 'postal_code'),
    city: Json.string(json, 'city'),
  );

  static Address? fromJsonOrNull(Map<String, Object?> json, String key) =>
      json[key] == null ? null : Address.fromJson(Json.child(json, key));

  String get oneLine => [
    line1,
    ?line2,
    '$postalCode $city',
  ].where((p) => p.trim().isNotEmpty).join(', ');
}
