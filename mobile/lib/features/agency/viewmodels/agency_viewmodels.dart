import '../../../core/state/async_view_model.dart';
import '../../../core/state/idempotent_writes.dart';
import '../models/agency_dashboard.dart';
import '../models/agency_intervention.dart';
import '../models/intervention_commands.dart';
import '../models/portfolio.dart';
import '../models/unpaid_item.dart';
import '../services/agency_service.dart';

class AgencyKpisViewModel(
  final AgencyService _service,
  final String organization, {
  super.logger,
}) extends AsyncViewModel<AgencyKpis> {
  @override
  Future<AgencyKpis> fetch() => _service.kpis(organization);
}

class AgencyPayoutsViewModel(
  final AgencyService _service,
  final String organization, {
  super.logger,
}) extends AsyncViewModel<AgencyPayouts> {
  @override
  Future<AgencyPayouts> fetch() => _service.payouts(organization);
}

class AgencyAlertsViewModel(
  final AgencyService _service,
  final String organization, {
  super.logger,
}) extends AsyncViewModel<AgencyAlerts> {
  @override
  Future<AgencyAlerts> fetch() => _service.alerts(organization);
}

class UnpaidViewModel(
  final AgencyService _service,
  final String organization, {
  final DateTime Function() clock = DateTime.now,
  super.logger,
}) extends AsyncViewModel<List<UnpaidItem>>
    with IdempotentWrites<List<UnpaidItem>> {
  DateTime get today {
    final now = clock();
    return DateTime(now.year, now.month, now.day);
  }

  @override
  Future<List<UnpaidItem>> fetch() async =>
      (await _service.unpaid(organization))
        ..sort((a, b) => b.daysOverdue.compareTo(a.daysOverdue));

  /// Un dossier de recouvrement est nécessaire : sans lui, aucune requête.
  Future<WriteResult> remind(UnpaidItem item, ReminderCommand command) {
    final caseId = item.caseId;
    if (caseId == null) return Future.value(const WriteIgnored());
    return write(
      'act|$caseId|${command.kind.key}|${command.day}|${command.note}',
      (key) =>
          _service.addAct(organization, caseId, command, idempotencyKey: key),
    );
  }
}

enum InterventionFilter(final String label, final InterventionStatus? status) {
  all('Toutes', null),
  toQualify('À qualifier', InterventionStatus.reported),
  toApprove('Devis à approuver', InterventionStatus.awaitingApproval),
  inProgress('En cours', InterventionStatus.inProgress),
}

class AgencyInterventionsViewModel(
  final AgencyService _service,
  final String organization, {
  super.logger,
}) extends AsyncViewModel<List<AgencyIntervention>> {
  InterventionFilter _filter = InterventionFilter.all;

  InterventionFilter get filter => _filter;

  Future<void> select(InterventionFilter filter) {
    if (filter == _filter) return Future.value();
    _filter = filter;
    return load(keepPrevious: false);
  }

  @override
  Future<List<AgencyIntervention>> fetch() =>
      _service.interventions(organization, status: _filter.status?.key);
}

class AgencyPropertiesViewModel(
  final AgencyService _service,
  final String organization, {
  super.logger,
}) extends AsyncViewModel<List<AgencyProperty>> {
  @override
  Future<List<AgencyProperty>> fetch() => _service.properties(organization);
}

/// Phases de bail proposées : le serveur filtre, l'application n'affiche
/// jamais une liste filtrée localement.
enum LeaseFilter(final String label, final String key) {
  running('En cours', 'running'),
  upcoming('À venir', 'upcoming'),
  notice('Congé donné', 'notice'),
  ended('Terminés', 'ended'),
}

class AgencyLeasesViewModel(
  final AgencyService _service,
  final String organization, {
  super.logger,
}) extends AsyncViewModel<List<AgencyLease>> {
  LeaseFilter _filter = LeaseFilter.running;

  LeaseFilter get filter => _filter;

  Future<void> select(LeaseFilter filter) {
    if (filter == _filter) return Future.value();
    _filter = filter;
    return load(keepPrevious: false);
  }

  @override
  Future<List<AgencyLease>> fetch() =>
      _service.leases(organization, phase: _filter.key);
}
