import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_body.dart';
import '../../../core/widgets/info_card.dart';
import '../../../core/widgets/key_value_row.dart';
import '../../../core/widgets/status_pill.dart';
import '../../../core/widgets/sub_page_scaffold.dart';
import '../models/installment.dart';
import '../tenant_paths.dart';
import '../viewmodels/installment_detail_viewmodel.dart';
import '../widgets/rent_cards.dart';

class const InstallmentScreen({super.key}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final viewModel = context.watch<InstallmentDetailViewModel>();
    return SubPageScaffold(
      title: 'Échéance',
      fallbackRoute: TenantPaths.rent,
      body: RefreshIndicator(
        onRefresh: viewModel.load,
        child: AsyncBody<Installment>(
          state: viewModel.state,
          onRetry: viewModel.load,
          builder: (context, installment) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(AppSpacing.screenGutter),
            children: [_Detail(installment: installment)],
          ),
        ),
      ),
    );
  }
}

class const _Detail({required final Installment installment})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final remaining = installment.remaining;
    final lines = installment.lines ?? const [];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        InfoCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                spacing: AppSpacing.sm,
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
                style: theme.textTheme.titleLarge,
              ),
              KeyValueRow(label: 'Bail', value: installment.lease.name),
              KeyValueRow(
                label: 'Période',
                value:
                    '${Formatters.dateLong(installment.periodStart)} au ${Formatters.dateLong(installment.periodEnd)}',
              ),
              KeyValueRow(
                label: 'Échéance',
                value: Formatters.dateLong(installment.dueDate),
              ),
              KeyValueRow(label: 'Loyer', value: installment.rent.text),
              KeyValueRow(label: 'Charges', value: installment.charges.text),
              KeyValueRow(
                label: 'Total',
                value: installment.total.text,
                emphasized: true,
              ),
              if (installment.isOpen)
                KeyValueRow(
                  label: 'Reste dû',
                  value: remaining?.text ?? 'Non disponible',
                  emphasized: true,
                ),
            ],
          ),
        ),
        if (lines.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          InfoCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Semantics(
                  header: true,
                  child: Text('Détail', style: theme.textTheme.titleMedium),
                ),
                for (final line in lines)
                  KeyValueRow(label: line.label, value: line.amount.text),
              ],
            ),
          ),
        ],
        const SizedBox(height: AppSpacing.md),
        InfoCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Semantics(
                header: true,
                child: Text('Documents', style: theme.textTheme.titleMedium),
              ),
              KeyValueRow(
                label: 'Avis d’échéance',
                value: installment.notice == null
                    ? 'Pas encore émis'
                    : '${installment.notice!.number} · ${Formatters.dateLong(installment.notice!.issuedOn)}',
              ),
              KeyValueRow(
                label: 'Quittance',
                value: installment.receipt == null
                    ? 'Non émise'
                    : '${installment.receipt!.number} · ${Formatters.dateLong(installment.receipt!.issuedOn)}',
              ),
              Text(
                'Le téléchargement des PDF n’est pas encore disponible dans l’application.',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: context.palette.textMuted,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
