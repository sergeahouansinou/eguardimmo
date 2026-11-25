import '../../../core/utils/json_reader.dart';

enum RequestState(final String label, final bool isOpen) {
  reported('En cours d’étude', true),
  inProgress('En cours', true),
  done('Terminée', false),
  declined('Classée sans suite', false),
  cancelled('Annulée', false);

  static RequestState parse(String value) => switch (value) {
    'reported' => reported,
    'in_progress' => inProgress,
    'done' => done,
    'declined' => declined,
    'cancelled' => cancelled,
    _ => throw FormatException('État de demande inconnu : $value'),
  };
}

enum VisitStatus(final String label) {
  proposed('À confirmer'),
  confirmed('Confirmée'),
  rescheduleRequested('Report demandé'),
  done('Effectuée'),
  cancelled('Annulée'),
  noShow('Absence constatée');

  static VisitStatus parse(String value) => switch (value) {
    'proposed' => proposed,
    'confirmed' => confirmed,
    'reschedule_requested' => rescheduleRequested,
    'done' => done,
    'cancelled' => cancelled,
    'no_show' => noShow,
    _ => throw FormatException('Statut de visite inconnu : $value'),
  };
}

String slotLabel(String slot) => switch (slot) {
  'morning' => 'matin',
  'afternoon' => 'après-midi',
  'evening' => 'fin de journée',
  _ => slot,
};

enum Urgency(final String value, final String label, final String hint) {
  urgent('urgent', 'Urgent', 'Risque de dégât important'),
  soon('soon', 'À traiter rapidement', 'Sous quelques jours'),
  normal('normal', 'Peut attendre', 'Sans gêne immédiate');

  static Urgency? parseOrNull(String? value) {
    for (final urgency in values) {
      if (urgency.value == value) return urgency;
    }
    return null;
  }
}

class const RequestVisit({
  required final String id,
  required final DateTime scheduledOn,
  required final String slot,
  required final bool presenceRequired,
  required final VisitStatus status,
}) {
  factory RequestVisit.fromJson(Map<String, Object?> json) => RequestVisit(
    id: Json.string(json, 'id'),
    scheduledOn: Json.day(json, 'scheduled_on'),
    slot: Json.string(json, 'slot'),
    presenceRequired: Json.boolean(json, 'presence_required'),
    status: VisitStatus.parse(Json.string(json, 'status')),
  );
}

class const RequestEvent({
  required final String id,
  required final bool byTenant,
  required final String text,
  required final DateTime createdAt,
}) {
  factory RequestEvent.fromJson(Map<String, Object?> json) => RequestEvent(
    id: Json.string(json, 'id'),
    byTenant: Json.string(json, 'author') == 'tenant',
    text: Json.string(json, 'text'),
    createdAt: Json.date(json, 'created_at'),
  );
}

class const TenantIntervention({
  required final String id,
  required final String reference,
  required final RequestState state,
  required final String title,
  required final String description,
  required final String place,
  required final DateTime reportedOn,
  required final bool cancellable,
  required final List<RequestVisit> visits,
  final String? natureLabel,
  final Urgency? urgency,
  final String? declineReason,
  final DateTime? completedOn,
  final List<RequestEvent>? events,
  final int? fileCount,
}) {
  factory TenantIntervention.fromJson(Map<String, Object?> json) {
    final decline = Json.childOrNull(json, 'decline');
    final events = json['events'];
    final files = json['files'];
    return TenantIntervention(
      id: Json.string(json, 'id'),
      reference: Json.string(json, 'reference'),
      state: RequestState.parse(Json.string(json, 'state')),
      title: Json.string(json, 'title'),
      description: Json.string(json, 'description'),
      place: Json.string(json, 'place'),
      reportedOn: Json.day(json, 'reported_on'),
      cancellable: Json.boolean(json, 'cancellable'),
      visits: [
        for (final visit in Json.list(json['visits'], 'visits'))
          RequestVisit.fromJson(Json.object(visit, 'visite')),
      ],
      natureLabel: Json.stringOrNull(Json.child(json, 'nature'), 'label'),
      urgency: Urgency.parseOrNull(Json.stringOrNull(json, 'reported_urgency')),
      declineReason: decline == null ? null : _declineLabel(decline),
      completedOn: json['completed_on'] == null
          ? null
          : Json.day(json, 'completed_on'),
      events: events == null
          ? null
          : [
              for (final event in Json.list(events, 'events'))
                RequestEvent.fromJson(Json.object(event, 'événement')),
            ],
      fileCount: files == null ? null : Json.list(files, 'files').length,
    );
  }

  static const _declineReasons = {
    'duplicate': 'Demande en double',
    'out_of_scope': 'Hors du périmètre de la gestion',
    'not_an_issue': 'Aucun désordre constaté',
    'tenant_responsibility': 'À la charge du locataire',
    'other': 'Autre motif',
  };

  static String _declineLabel(Map<String, Object?> decline) {
    final reason = Json.string(decline, 'reason');
    final label = _declineReasons[reason] ?? 'Autre motif';
    final note = Json.stringOrNull(decline, 'note');
    return note == null ? label : '$label. $note';
  }

  RequestVisit? get nextVisit {
    const active = {
      VisitStatus.proposed,
      VisitStatus.confirmed,
      VisitStatus.rescheduleRequested,
    };
    final candidates = visits.where((v) => active.contains(v.status)).toList()
      ..sort((a, b) => a.scheduledOn.compareTo(b.scheduledOn));
    return candidates.firstOrNull;
  }
}
