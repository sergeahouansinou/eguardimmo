import 'package:eguardimmo/features/agency/models/agency_dashboard.dart';
import 'package:eguardimmo/features/agency/models/agency_intervention.dart';
import 'package:eguardimmo/features/agency/models/portfolio.dart';
import 'package:eguardimmo/features/agency/models/unpaid_item.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/api_fixtures.dart';

Map<String, Object?> _data(String fixture) =>
    apiObject(fixture)['data']! as Map<String, Object?>;

List<Map<String, Object?>> _list(String fixture) =>
    (apiObject(fixture)['data']! as List<Object?>).cast<Map<String, Object?>>();

void main() {
  test('indicateurs : montants en unités mineures, taux sans flottant', () {
    final kpis = AgencyKpis.fromJson(_data('agency/kpis'));
    expect(kpis.rentCalled.minor, 70000);
    expect(kpis.feesNet.currency, 'EUR');
    expect(kpis.collectionRateText, '97,1 %');
    expect(kpis.periodClosed, isTrue);
    expect(kpis.monthStart, DateTime(2026, 11));
  });

  test('indicateurs : aucun loyer appelé, taux absent', () {
    final json = Map<String, Object?>.of(_data('agency/kpis'))
      ..['collection_rate_basis_points'] = null;
    expect(AgencyKpis.fromJson(json).collectionRateText, isNull);
  });

  test('taux : 100 % et 5,0 % arrondis à la décimale inférieure', () {
    AgencyKpis rate(int points) => AgencyKpis.fromJson(
      Map<String, Object?>.of(_data('agency/kpis'))
        ..['collection_rate_basis_points'] = points,
    );
    expect(rate(10000).collectionRateText, '100,0 %');
    expect(rate(500).collectionRateText, '5,0 %');
    expect(rate(0).collectionRateText, '0,0 %');
  });

  test('reversements : propriétaire sans nom conservé tel quel', () {
    final payouts = AgencyPayouts.fromJson(_data('agency/payouts'));
    expect(payouts.payableTotal.minor, 130000);
    expect(payouts.topMandants.map((m) => m.name), ['Awa Diallo', null]);
    expect(payouts.activeHolds, 1);
  });

  test('alertes : mandats à renouveler et comptes rendus dus', () {
    final alerts = AgencyAlerts.fromJson(_data('agency/alerts'));
    expect(alerts.mandatesToRenewCount, 1);
    expect(alerts.mandatesToRenew.single.reference, 'MG-2026-0001');
    expect(alerts.certificatesToRenew, 3);
    expect(alerts.reportsDue, 2);
    expect(alerts.reportsPeriodEnd, DateTime(2026, 10, 31));
  });

  test('impayés : réponse réelle, dossier et période optionnels', () {
    final items = _list('agency/unpaid').map(UnpaidItem.fromJson).toList();
    expect(items, hasLength(3));
    expect(items.first.kind, UnpaidKind.installment);
    expect(items.first.status, UnpaidStatus.partiallyPaid);
    expect(items.first.daysOverdue, 72);
    expect(items.first.outstanding.minor, 45000);
    expect(items.first.caseNumber, isNull);
    expect(items.first.partyName, 'Célina Barre');
  });

  test('impayé : facture sans période ni locataire, dossier présent', () {
    final json = Map<String, Object?>.of(_list('agency/unpaid').first)
      ..['type'] = 'invoice'
      ..['period'] = null
      ..['party'] = null
      ..['case'] = {'id': 'c1', 'number': 'DR-2026-0001'};
    final item = UnpaidItem.fromJson(json);
    expect(item.kind, UnpaidKind.invoice);
    expect(item.periodStart, isNull);
    expect(item.partyName, isNull);
    expect(item.caseNumber, 'DR-2026-0001');
  });

  test('impayé : statut inconnu refusé, jamais deviné', () {
    final json = Map<String, Object?>.of(_list('agency/unpaid').first)
      ..['status'] = 'written_off';
    expect(() => UnpaidItem.fromJson(json), throwsFormatException);
  });

  test('interventions : réponses réelles, tous les statuts rencontrés', () {
    final items = _list('agency/interventions')
        .map(AgencyIntervention.fromJson)
        .toList();
    expect(items.map((i) => i.status), [
      InterventionStatus.reported,
      InterventionStatus.declined,
      InterventionStatus.cancelled,
      InterventionStatus.invoiced,
    ]);
    expect(items.last.supplierName, 'Ramonage du Port SARL');
    expect(items.last.mandantName, 'Franck Renault');
    expect(items.last.estimatedAmount?.minor, 60000);
    expect(items.first.unitLabel, 'Résidence Roy · LOT-28755');
    expect(items.first.reportedByTenant, isTrue);
  });

  test('intervention : les douze statuts du serveur sont connus', () {
    for (final key in [
      'reported',
      'qualified',
      'declined',
      'cancelled',
      'quoting',
      'awaiting_approval',
      'approved',
      'scheduled',
      'in_progress',
      'completed',
      'invoiced',
      'closed',
    ]) {
      expect(InterventionStatus.parse(key).key, key);
    }
    expect(() => InterventionStatus.parse('lost'), throwsFormatException);
  });

  test('biens et baux : adresse sans ligne 2, bail sans lot ni locataire', () {
    final properties = _list('agency/properties')
        .map(AgencyProperty.fromJson)
        .toList();
    expect(
      properties.last.address.oneLine,
      '3 chemin des Pins, 69110 Sainte-Foy-lès-Lyon',
    );
    expect(properties.first.kind, PropertyKind.building);

    final leases = _list('agency/leases').map(AgencyLease.fromJson).toList();
    expect(leases.first.tenantNames, ['Édouard Gillet', 'Léa Gillet']);
    expect(leases.first.unitLabel, 'Résidence Roy · LOT-28755');
    expect(leases.first.endDate, DateTime(2028, 12, 31));
    expect(leases.last.unitLabel, isNull);
    expect(leases.last.endDate, isNull);
    expect(leases.last.tenantNames, isEmpty);
  });
}
