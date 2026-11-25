import '../../../core/utils/json_reader.dart';

class const Place({
  required final String slug,
  required final String name,
  required final String? postalCode,
  required final String country,
}) {
  /// `GET /marketplace/places?q=` : `{slug, name, postal_code, country}` ; le
  /// slug sert de filtre `place`.
  factory Place.fromJson(Map<String, Object?> json) => Place(
    slug: Json.string(json, 'slug'),
    name: Json.string(json, 'name'),
    postalCode: Json.stringOrNull(json, 'postal_code'),
    country: Json.string(json, 'country'),
  );

  String get label => postalCode == null ? name : '$name ($postalCode)';
}
