import 'package:eguardimmo/core/models/money.dart';
import 'package:eguardimmo/core/utils/cursor_pages.dart';
import 'package:eguardimmo/features/tenant/models/installment.dart';
import 'package:eguardimmo/features/tenant/models/lease_document.dart';
import 'package:eguardimmo/features/tenant/models/rent_payment.dart';
import 'package:eguardimmo/features/tenant/models/rent_receipt.dart';
import 'package:eguardimmo/features/tenant/models/report_option.dart';
import 'package:eguardimmo/features/tenant/models/tenant_intervention.dart';
import 'package:eguardimmo/features/tenant/models/tenant_lease.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/api_fixtures.dart';

List<T> page<T>(String name, T Function(Map<String, Object?>) read) =>
    CursorPages.parse(apiFixture(name), name, read).items;

void main() {
  group('Échéances (réponses réelles)', () {
    test('liste : montants en unités mineures, reste dû, avis', () {
      final items = page('tenant/installments', Installment.fromJson);
      expect(items, hasLength(2));
      final november = items[1];
      expect(november.status, InstallmentStatus.issued);
      expect(november.isOverdue, isTrue);
      expect(november.total, const Money(65000, 'EUR'));
      expect(november.remaining, const Money(65000, 'EUR'));
      expect(november.notice?.number, 'AV-2026-0001');
      expect(november.receipt, isNull);
      expect(items[0].notice, isNull);
    });

    test('soldée : quittance liée, aucun reste présenté', () {
      final paid = page(
        'tenant/installments_paid',
        Installment.fromJson,
      ).single;
      expect(paid.status, InstallmentStatus.paid);
      expect(paid.receipt?.number, 'QT-2026-0001');
      expect(paid.remaining, isNull);
    });

    test('partiellement payée : reste calculé par le serveur', () {
      final partial = page(
        'tenant/installments_partial',
        Installment.fromJson,
      ).single;
      expect(partial.status, InstallmentStatus.partiallyPaid);
      expect(partial.remaining, const Money(35000, 'EUR'));
    });

    test('détail : lignes du calcul', () {
      final detail = Installment.fromJson(
        apiObject('tenant/installment_issued')['data']! as Map<String, Object?>,
      );
      expect(detail.lines, hasLength(1));
      expect(detail.lines!.single.label, 'Loyer de novembre 2026');
      expect(detail.lines!.single.amount.minor, 65000);
    });

    test('statut inconnu : erreur franche, pas de valeur par défaut', () {
      expect(
        () => InstallmentStatus.parse('refunded'),
        throwsA(isA<FormatException>()),
      );
    });
  });

  test('paiements : enregistré et annulé', () {
    final payments = page('tenant/payments_cancelled', RentPayment.fromJson);
    expect(payments.first.cancelled, isTrue);
    expect(payments.first.cancelledOn, isNotNull);
    expect(payments.last.cancelled, isFalse);
    expect(payments.last.method, PaymentMethod.transfer);
    expect(payments.last.amount.minor, 30000);
  });

  test('quittances : annulée signalée, période et bien', () {
    final receipt = page('tenant/receipts', RentReceipt.fromJson).single;
    expect(receipt.number, 'QT-2026-0001');
    expect(receipt.isVoid, isFalse);
    expect(receipt.propertyName, 'Résidence Fournier');
    expect(receipt.periodStart, DateTime(2026, 11));
    expect(
      page('tenant/receipts_void', RentReceipt.fromJson).single.isVoid,
      isTrue,
    );
  });

  test('baux et documents partagés', () {
    final lease = page('tenant/leases', TenantLease.fromJson).single;
    expect(lease.phase, LeasePhase.running);
    expect(lease.agencyName, 'Agence du Port');
    expect(lease.mainUnit?.typeLabel, 'Appartement');
    expect(lease.mainUnit?.address.oneLine, '12 rue du Port, 13002 Marseille');

    final documents = page('tenant/lease_documents', LeaseDocument.fromJson);
    expect(documents.first.kindLabel, 'Avenant');
    expect(documents.first.sizeBytes, 245760);
    expect(documents.last.fileName, isNull);
  });

  group('Demandes d’intervention', () {
    test('liste : états et motif de classement', () {
      final items = page('tenant/interventions', TenantIntervention.fromJson);
      expect(items.map((i) => i.state).toSet(), {
        RequestState.reported,
        RequestState.declined,
        RequestState.cancelled,
        RequestState.done,
      });
      expect(
        items.firstWhere((i) => i.state == RequestState.declined).declineReason,
        'Aucun désordre constaté. Aucun désordre constaté.',
      );
      expect(items.first.cancellable, isTrue);
      expect(items.first.events, isNull);
    });

    test('détail : historique et photos comptées', () {
      final detail = TenantIntervention.fromJson(
        apiObject('tenant/intervention_open')['data']! as Map<String, Object?>,
      );
      expect(detail.events, hasLength(5));
      expect(detail.events!.first.byTenant, isTrue);
      expect(detail.events!.last.byTenant, isFalse);
      expect(detail.fileCount, 2);
    });

    test('visite proposée : prochaine visite à confirmer', () {
      final detail = TenantIntervention.fromJson(
        apiObject('tenant/intervention_proposed')['data']!
            as Map<String, Object?>,
      );
      expect(detail.nextVisit?.status, VisitStatus.proposed);
      expect(detail.nextVisit?.scheduledOn, DateTime(2026, 11, 20));
      expect(slotLabel(detail.nextVisit!.slot), 'matin');
    });

    test('options de signalement : natures et lieux', () {
      final options = [
        for (final entry
            in apiObject('tenant/intervention_options')['data']!
                as List<Object?>)
          ReportOption.fromJson(entry! as Map<String, Object?>),
      ];
      expect(options.single.natures.map((n) => n.label), contains('Plomberie'));
      expect(options.single.commonAreaAllowed, isTrue);
      expect(options.single.units.single.label, 'Résidence Roy - LOT-28755');
    });
  });
}
