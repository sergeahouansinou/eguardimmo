import '../../../core/utils/json_reader.dart';

class const Choice({required final String id, required final String label}) {
  factory Choice.fromJson(Map<String, Object?> json) =>
      Choice(id: Json.string(json, 'id'), label: Json.string(json, 'label'));
}

class const ReportOption({
  required final String leaseId,
  required final String label,
  required final List<Choice> units,
  required final bool commonAreaAllowed,
  required final List<Choice> natures,
}) {
  factory ReportOption.fromJson(Map<String, Object?> json) => ReportOption(
    leaseId: Json.string(json, 'lease_id'),
    label: Json.string(json, 'label'),
    units: _choices(json, 'units'),
    commonAreaAllowed: Json.boolean(json, 'common_area_allowed'),
    natures: _choices(json, 'natures'),
  );

  static List<Choice> _choices(Map<String, Object?> json, String key) => [
    for (final entry in Json.list(json[key], key))
      Choice.fromJson(Json.object(entry, key)),
  ];
}
