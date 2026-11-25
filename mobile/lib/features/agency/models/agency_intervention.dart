import '../../../core/models/money.dart';
import '../../../core/utils/json_reader.dart';

enum InterventionStatus(final String label, final String key) {
  reported('Signalée', 'reported'),
  qualified('Qualifiée', 'qualified'),
  declined('Refusée', 'declined'),
  cancelled('Annulée', 'cancelled'),
  quoting('Devis en cours', 'quoting'),
  awaitingApproval('Devis à approuver', 'awaiting_approval'),
  approved('Approuvée', 'approved'),
  scheduled('Planifiée', 'scheduled'),
  inProgress('En cours', 'in_progress'),
  completed('Terminée', 'completed'),
  invoiced('Facturée', 'invoiced'),
  closed('Clôturée', 'closed');

  static InterventionStatus parse(String value) {
    for (final status in values) {
      if (status.key == value) return status;
    }
    throw FormatException('Statut d’intervention inconnu : $value');
  }
}

enum InterventionPriority(final String label) {
  urgent('Urgente'),
  normal('Normale'),
  low('Basse');

  static InterventionPriority parse(String value) => switch (value) {
    'urgent' => urgent,
    'normal' => normal,
    'low' => low,
    _ => throw FormatException('Priorité inconnue : $value'),
  };
}

class const AgencyIntervention({
  required final String id,
  required final String reference,
  required final InterventionStatus status,
  required final InterventionPriority priority,
  required final String title,
  required final String unitLabel,
  required final DateTime reportedOn,
  required final bool reportedByTenant,
  final String? mandantName,
  final String? supplierName,
  final DateTime? dueOn,
  final Money? estimatedAmount,
}) {
  factory AgencyIntervention.fromJson(Map<String, Object?> json) {
    final unit = Json.child(json, 'unit');
    final mandant = Json.childOrNull(json, 'mandant');
    final supplier = Json.childOrNull(json, 'supplier');
    return AgencyIntervention(
      id: Json.string(json, 'id'),
      reference: Json.string(json, 'reference'),
      status: InterventionStatus.parse(Json.string(json, 'status')),
      priority: InterventionPriority.parse(Json.string(json, 'priority')),
      title: Json.string(json, 'title'),
      unitLabel:
          '${Json.string(unit, 'property_name')} · ${Json.string(unit, 'reference')}',
      reportedOn: Json.day(json, 'reported_on'),
      reportedByTenant: Json.string(json, 'origin') == 'tenant',
      mandantName: mandant == null ? null : Json.stringOrNull(mandant, 'name'),
      supplierName: supplier == null
          ? null
          : Json.stringOrNull(supplier, 'name'),
      dueOn: json['due_on'] == null ? null : Json.day(json, 'due_on'),
      estimatedAmount: Money.fromJsonOrNull(json, 'estimated_amount'),
    );
  }
}
