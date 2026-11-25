import 'package:flutter/material.dart';

import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/info_card.dart';
import '../../../core/widgets/status_pill.dart';
import '../models/installment.dart';
import '../models/rent_payment.dart';
import '../models/rent_receipt.dart';

PillTone installmentTone(Installment installment) {
  if (installment.status == InstallmentStatus.paid) return PillTone.success;
  return installment.isOverdue ? PillTone.danger : PillTone.info;
}

String installmentTitle(Installment installment) =>
    'Loyer de ${Formatters.monthYear(installment.periodStart).toLowerCase()}';

class const InstallmentCard({
  super.key,
  required final Installment installment,
  final VoidCallback? onTap,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final p = context.palette;
    final remaining = installment.remaining;
    return InfoCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.xs,
            children: [
              StatusPill(
                label: installment.status.label,
                tone: installmentTone(installment),
              ),
              if (installment.isOverdue && installment.isOpen)
                const StatusPill(label: 'En retard', tone: PillTone.danger),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            installmentTitle(installment),
            style: theme.textTheme.titleMedium,
          ),
          Text(
            'Échéance le ${Formatters.dateLong(installment.dueDate)} · ${installment.lease.name}',
            style: theme.textTheme.bodyMedium?.copyWith(color: p.textMuted),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(installment.total.text, style: theme.textTheme.titleMedium),
          if (remaining != null && installment.isOpen)
            Text(
              'Reste dû : ${remaining.text}',
              style: theme.textTheme.bodyMedium,
            ),
        ],
      ),
    );
  }
}

class const PaymentCard({super.key, required final RentPayment payment})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final p = context.palette;
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          StatusPill(
            label: payment.cancelled ? 'Annulé' : 'Enregistré',
            tone: payment.cancelled ? PillTone.neutral : PillTone.success,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(payment.amount.text, style: theme.textTheme.titleMedium),
          Text(
            '${payment.method.label} · reçu le ${Formatters.dateLong(payment.receivedOn)}',
            style: theme.textTheme.bodyMedium?.copyWith(color: p.textMuted),
          ),
          Text(payment.lease.name, style: theme.textTheme.bodySmall),
          if (payment.cancelledOn case final cancelledOn?)
            Text(
              'Annulé le ${Formatters.dateLong(cancelledOn)}',
              style: theme.textTheme.bodySmall,
            ),
        ],
      ),
    );
  }
}

class const ReceiptCard({super.key, required final RentReceipt receipt})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final p = context.palette;
    final start = receipt.periodStart;
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (receipt.isVoid)
            const StatusPill(label: 'Annulée', tone: PillTone.neutral),
          if (receipt.isVoid) const SizedBox(height: AppSpacing.sm),
          Text(
            'Quittance ${receipt.number}',
            style: theme.textTheme.titleMedium,
          ),
          Text(
            [
              ?start == null ? null : Formatters.monthYear(start),
              'émise le ${Formatters.dateLong(receipt.issuedOn)}',
            ].join(' · '),
            style: theme.textTheme.bodyMedium?.copyWith(color: p.textMuted),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(receipt.total.text, style: theme.textTheme.titleMedium),
          Text(receipt.lease.name, style: theme.textTheme.bodySmall),
        ],
      ),
    );
  }
}
