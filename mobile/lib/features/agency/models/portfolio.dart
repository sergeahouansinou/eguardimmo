import '../../../core/models/address.dart';
import '../../../core/utils/json_reader.dart';

enum PropertyKind(final String label) {
  building('Immeuble'),
  house('Maison'),
  complex('Ensemble immobilier');

  static PropertyKind parse(String value) => switch (value) {
    'building' => building,
    'house' => house,
    'complex' => complex,
    _ => throw FormatException('Type de bien inconnu : $value'),
  };
}

enum AgencyLeasePhase(final String label) {
  draft('Brouillon'),
  upcoming('À venir'),
  running('En cours'),
  notice('Congé donné'),
  ended('Terminé');

  static AgencyLeasePhase parse(String value) => switch (value) {
    'draft' => draft,
    'upcoming' => upcoming,
    'running' => running,
    'notice' => notice,
    'ended' => ended,
    _ => throw FormatException('Phase de bail inconnue : $value'),
  };
}

class const AgencyProperty({
  required final String id,
  required final String name,
  required final PropertyKind kind,
  required final Address address,
  required final int activeUnits,
}) {
  factory AgencyProperty.fromJson(Map<String, Object?> json) => AgencyProperty(
    id: Json.string(json, 'id'),
    name: Json.string(json, 'name'),
    kind: PropertyKind.parse(Json.string(json, 'type')),
    address: Address.fromJson(Json.child(json, 'address')),
    activeUnits: Json.integer(json, 'active_units_count'),
  );
}

class const AgencyLease({
  required final String id,
  required final String reference,
  required final AgencyLeasePhase phase,
  required final DateTime startsOn,
  required final List<String> tenantNames,
  final DateTime? endDate,
  final String? unitLabel,
}) {
  factory AgencyLease.fromJson(Map<String, Object?> json) {
    final unit = Json.childOrNull(json, 'main_unit');
    return AgencyLease(
      id: Json.string(json, 'id'),
      reference: Json.string(json, 'reference'),
      phase: AgencyLeasePhase.parse(Json.string(json, 'phase')),
      startsOn: Json.day(json, 'starts_on'),
      endDate: json['end_date'] == null ? null : Json.day(json, 'end_date'),
      unitLabel: unit == null
          ? null
          : '${Json.string(Json.child(unit, 'property'), 'name')} · ${Json.string(unit, 'reference')}',
      tenantNames: [
        for (final tenant in Json.list(json['tenants'], 'tenants'))
          Json.string(Json.object(tenant, 'locataire'), 'display_name'),
      ],
    );
  }
}
