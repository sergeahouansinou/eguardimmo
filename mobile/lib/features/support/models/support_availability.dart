import '../../../core/utils/json_reader.dart';

/// `GET /support/status` : horaires et délai de réponse servis par la
/// configuration du serveur, jamais codés dans l'application.
class const SupportAvailability({
  required final bool online,
  required final String hoursLabel,
  required final String responseLabel,
  required final String timezone,
}) {
  factory SupportAvailability.fromJson(Map<String, Object?> json) =>
      SupportAvailability(
        online: Json.boolean(json, 'online'),
        hoursLabel: Json.string(json, 'hours_label'),
        responseLabel: Json.string(json, 'response_label'),
        timezone: Json.string(json, 'timezone'),
      );
}
