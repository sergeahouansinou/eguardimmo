import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_section.dart';
import '../../../core/widgets/coming_soon_card.dart';
import '../../../core/widgets/key_value_row.dart';
import '../../../core/widgets/nav_tile.dart';
import '../../../core/widgets/status_pill.dart';
import '../../profiles/widgets/profile_home_scaffold.dart';
import '../models/installment.dart';
import '../models/tenant_intervention.dart';
import '../models/tenant_lease.dart';
import '../tenant_paths.dart';
import '../viewmodels/installments_viewmodel.dart';
import '../viewmodels/requests_viewmodel.dart';
import '../viewmodels/tenant_leases_viewmodels.dart';
import '../widgets/rent_cards.dart';

class const TenantHomeScreen({super.key}) extends StatelessWidget {
  static const comingSoon = [
    'Paiement du loyer en ligne',
    'Téléchargement des avis d’échéance et des quittances (PDF)',
    'Demande de congé (réservée à l’espace web : l’API refuse le jeton mobile et exige une double authentification)',
    'Assurance, état des lieux et décompte de charges',
  ];

  @override
  Widget build(BuildContext context) {
    final rent = context.watch<InstallmentsViewModel>();
    final leases = context.watch<TenantLeasesViewModel>();
    final requests = context.watch<RequestsViewModel>();
    return ProfileHomeScaffold(
      onRefresh: () =>
          Future.wait([rent.load(), leases.load(), requests.load()]),
      children: [
        AsyncSection<List<Installment>>(
          title: 'Mon loyer',
          state: rent.state,
          onRetry: rent.load,
          emptyMessage: 'Aucune échéance appelée pour le moment.',
          isEmpty: (items) => items.isEmpty,
          builder: (context, _) => _RentSummary(rent: rent),
        ),
        AsyncSection<List<TenantLease>>(
          title: 'Mon logement',
          state: leases.state,
          onRetry: leases.load,
          emptyMessage: 'Aucun bail n’est rattaché à votre compte.',
          isEmpty: (items) => items.isEmpty,
          builder: (context, _) => _LeaseSummary(lease: leases.current!),
        ),
        AsyncSection<List<TenantIntervention>>(
          title: 'Mes demandes',
          state: requests.state,
          onRetry: requests.load,
          emptyMessage: 'Aucune demande d’intervention.',
          isEmpty: (items) => items.isEmpty,
          builder: (context, items) {
            final open = items.where((r) => r.state.isOpen).length;
            return Text(
              open == 0
                  ? 'Aucune demande en cours.'
                  : '$open demande${open > 1 ? 's' : ''} en cours.',
              style: Theme.of(context).textTheme.bodyMedium,
            );
          },
        ),
        NavTile(
          icon: Icons.receipt_long_rounded,
          title: 'Loyers',
          subtitle: 'Échéances, paiements et quittances',
          onTap: () => context.push(TenantPaths.rent),
        ),
        NavTile(
          icon: Icons.build_circle_outlined,
          title: 'Demandes d’intervention',
          subtitle: 'Signaler un problème et suivre les demandes',
          onTap: () => context.push(TenantPaths.requests),
        ),
        NavTile(
          icon: Icons.folder_open_rounded,
          title: 'Documents',
          subtitle: 'Pièces partagées par votre agence',
          onTap: () => context.push(TenantPaths.documents),
        ),
        const ComingSoonCard(items: comingSoon),
      ],
    );
  }
}

class const _RentSummary({required final InstallmentsViewModel rent})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final next = rent.next;
    final balance = rent.balance;
    if (next == null) {
      return Text(
        'Toutes vos échéances sont soldées.',
        style: theme.textTheme.bodyMedium,
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          spacing: AppSpacing.sm,
          children: [
            StatusPill(
              label: next.isOverdue ? 'En retard' : 'À venir',
              tone: next.isOverdue ? PillTone.danger : PillTone.info,
            ),
          ],
        ),
        KeyValueRow(label: 'Prochaine échéance', value: installmentTitle(next)),
        KeyValueRow(
          label: 'À régler avant le',
          value: Formatters.dateLong(next.dueDate),
        ),
        KeyValueRow(label: 'Montant appelé', value: next.total.text),
        KeyValueRow(
          label: 'Reste dû',
          value: balance.outstanding.isEmpty
              ? (balance.incomplete ? 'Non disponible' : 'Aucun')
              : balance.outstanding.map((m) => m.text).join(' + '),
          emphasized: true,
        ),
        if (balance.incomplete && balance.outstanding.isNotEmpty)
          Text(
            'Le reste dû de certaines échéances n’est pas disponible.',
            style: theme.textTheme.bodySmall?.copyWith(
              color: context.palette.textMuted,
            ),
          ),
        if (rent.overdueCount > 0)
          Text(
            '${rent.overdueCount} échéance${rent.overdueCount > 1 ? 's' : ''} en retard.',
            style: theme.textTheme.bodySmall,
          ),
      ],
    );
  }
}

class const _LeaseSummary({required final TenantLease lease})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final unit = lease.mainUnit;
    return Column(
      children: [
        KeyValueRow(label: 'Bail', value: lease.reference),
        KeyValueRow(label: 'Situation', value: lease.phase.label),
        if (unit != null) ...[
          KeyValueRow(
            label: 'Logement',
            value: '${unit.typeLabel} ${unit.reference}, ${unit.propertyName}',
          ),
          KeyValueRow(label: 'Adresse', value: unit.address.oneLine),
        ],
        KeyValueRow(label: 'Agence', value: lease.agencyName),
        KeyValueRow(label: 'Début', value: Formatters.dateLong(lease.startsOn)),
        if (lease.endDate case final end?)
          KeyValueRow(label: 'Fin', value: Formatters.dateLong(end)),
      ],
    );
  }
}
