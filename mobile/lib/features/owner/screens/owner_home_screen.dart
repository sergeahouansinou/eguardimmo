import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_section.dart';
import '../../../core/widgets/coming_soon_card.dart';
import '../../../core/widgets/inline_message.dart';
import '../../../core/widgets/key_value_row.dart';
import '../../../core/widgets/nav_tile.dart';
import '../../../core/widgets/status_pill.dart';
import '../../profiles/widgets/profile_home_scaffold.dart';
import '../models/owner_home.dart';
import '../owner_paths.dart';
import '../viewmodels/owner_access_viewmodel.dart';
import '../viewmodels/owner_home_viewmodel.dart';
import '../widgets/access_notices.dart';
import '../widgets/owner_cards.dart';

class const OwnerHomeScreen({super.key}) extends StatelessWidget {
  static const comingSoon = [
    'Téléchargement des comptes rendus de gestion (PDF)',
    'Décision sur les devis d’intervention et fin de mandat (réservées à l’espace web : l’API refuse le jeton mobile et exige une double authentification)',
    'Compte de versement',
  ];

  @override
  Widget build(BuildContext context) {
    final access = context.watch<OwnerAccessViewModel>();
    final home = context.watch<OwnerHomeViewModel>();
    final selected = access.selected!;
    return ProfileHomeScaffold(
      onRefresh: () => Future.wait([access.load(), home.load()]),
      children: [
        if (access.accesses.length > 1) const AgencySelector(),
        if (selected.readOnly || selected.inGrace)
          AccessNotice(access: selected),
        AsyncSection<OwnerHome>(
          title: 'Ce mois-ci',
          state: home.state,
          onRetry: home.load,
          builder: (context, data) => _MonthSummary(home: data),
        ),
        AsyncSection<OwnerHome>(
          title: 'Reversements',
          state: home.state,
          onRetry: home.load,
          isEmpty: (data) => data.payouts == null,
          emptyMessage: 'Aucun reversement pour le moment.',
          builder: (context, data) => _PayoutsSummary(payouts: data.payouts!),
        ),
        AsyncSection<OwnerHome>(
          title: 'Compte rendu de gestion',
          state: home.state,
          onRetry: home.load,
          isEmpty: (data) => data.lastReport == null,
          emptyMessage: 'Aucun compte rendu publié pour le moment.',
          builder: (context, data) => _ReportSummary(report: data.lastReport!),
        ),
        AsyncSection<OwnerHome>(
          title: 'Mes biens',
          state: home.state,
          onRetry: home.load,
          isEmpty: (data) => data.units.isEmpty,
          emptyMessage: 'Aucun bien n’est rattaché à votre mandat.',
          builder: (context, data) => Column(
            children: [for (final unit in data.units) HomeUnitTile(unit: unit)],
          ),
        ),
        NavTile(
          icon: Icons.account_balance_wallet_outlined,
          title: 'Reversements',
          subtitle: 'Virements reçus et prochain reversement',
          onTap: () => context.push(OwnerPaths.payouts),
        ),
        NavTile(
          icon: Icons.receipt_long_rounded,
          title: 'Relevé de compte',
          subtitle: 'Opérations mois par mois',
          onTap: () => context.push(OwnerPaths.statement),
        ),
        NavTile(
          icon: Icons.apartment_rounded,
          title: 'Biens',
          subtitle: 'Lots sous mandat',
          onTap: () => context.push(OwnerPaths.properties),
        ),
        NavTile(
          icon: Icons.folder_open_rounded,
          title: 'Documents',
          subtitle: 'Mandat, avenants et pièces partagées',
          onTap: () => context.push(OwnerPaths.documents),
        ),
        const ComingSoonCard(items: comingSoon),
      ],
    );
  }
}

class const _MonthSummary({required final OwnerHome home})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final arrears = home.arrears;
    final days = home.arrearsMaxDays;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        KeyValueRow(
          label: 'Période',
          value: Formatters.monthYear(home.monthStart),
        ),
        KeyValueRow(label: 'Loyers appelés', value: home.called.text),
        KeyValueRow(label: 'Loyers encaissés', value: home.collected.text),
        KeyValueRow(
          label: 'Impayés',
          value: arrears.isZero
              ? 'Aucun'
              : '${arrears.text} (${home.arrearsCount} échéance${home.arrearsCount > 1 ? 's' : ''}, jusqu’à $days jour${days > 1 ? 's' : ''} de retard)',
          emphasized: !arrears.isZero,
        ),
        if (home.quotesToDecide > 0) ...[
          const SizedBox(height: AppSpacing.sm),
          InlineMessage(
            message:
                '${home.quotesToDecide} devis attend${home.quotesToDecide > 1 ? 'ent' : ''} votre décision : à traiter depuis le site.',
            tone: PillTone.info,
          ),
        ],
      ],
    );
  }
}

class const _PayoutsSummary({required final HomePayouts payouts})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final pending = payouts.pending;
    final last = payouts.last;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (pending != null) ...[
          KeyValueRow(
            label: 'En préparation (net)',
            value: pending.net.text,
            emphasized: true,
          ),
          KeyValueRow(label: 'Honoraires déduits', value: pending.fees.text),
        ],
        if (last != null)
          KeyValueRow(
            label: 'Dernier reversement',
            value: last.date == null
                ? last.amount.text
                : '${last.amount.text}, ${Formatters.dateLong(last.date!)}',
          ),
        if (payouts.nextDate case final next?)
          KeyValueRow(
            label: 'Prochain reversement',
            value: Formatters.dateLong(next),
          ),
        if (payouts.nextNotice case final notice?)
          Text(
            payoutNoticeLabel(notice),
            style: theme.textTheme.bodySmall?.copyWith(
              color: context.palette.textMuted,
            ),
          ),
      ],
    );
  }
}

class const _ReportSummary({required final HomeReport report})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          spacing: AppSpacing.sm,
          children: [
            if (!report.isRead)
              const StatusPill(label: 'Non lu', tone: PillTone.info),
          ],
        ),
        KeyValueRow(label: 'Numéro', value: report.number),
        KeyValueRow(
          label: 'Période',
          value: Formatters.dateRange(report.periodStart, report.periodEnd),
        ),
      ],
    );
  }
}
