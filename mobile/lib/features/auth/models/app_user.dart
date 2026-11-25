import '../../../core/utils/json_reader.dart';

class const AppUser({
  required final String id,
  required final String name,
  required final String email,
  required final DateTime? emailVerifiedAt,
  required final String? phone,
}) {
  factory AppUser.fromJson(Map<String, Object?> json) => AppUser(
    id: Json.string(json, 'id'),
    name: Json.string(json, 'name'),
    email: Json.string(json, 'email'),
    emailVerifiedAt: Json.dateOrNull(json, 'email_verified_at'),
    phone: Json.stringOrNull(json, 'phone'),
  );

  bool get emailVerified => emailVerifiedAt != null;
}
