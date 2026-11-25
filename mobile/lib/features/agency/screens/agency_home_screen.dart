import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/routes/app_routes.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/async_section.dart';
import '../../../core/widgets/coming_soon_card.dart';
import '../../../core/widgets/key_value_row.dart';
import '../../../core/widgets/nav_tile.dart';
import '../../../core/widgets/status_pill.dart';
import '../../profiles/widgets/profile_home_scaffold.dart';
import '../models/agency_dashboard.dart';
import '../viewmodels/agency_viewmodels.dart';

class const AgencyHomeScreen({super.key}) extends StatelessWidget {
  static const comingSoon = [
    'Visites, engagement d’urgence, clôture et factures fournisseurs des interventions',
    'Dépôt de pièces et de photos sur les interventions',
    'Ouverture de dossiers de recouvrement et mises en demeure',
    'Création et modification de biens et de baux',
  ];

  @override
  Widget build(BuildContext context) {
    final kpis = context.watch<AgencyKpisViewModel>();
    final payouts = context.watch<AgencyPayoutsViewModel>();
    final alerts = context.watch<AgencyAlertsViewModel>();
    return ProfileHomeScaffold(
      onRefresh: () =>
          Future.wait([kpis.load(), payouts.load(), alerts.load()]),
      children: [
        AsyncSection<AgencyKpis>(
          title: 'Loyers du mois',
          state: kpis.state,
          onRetry: kpis.load,
          builder: (context, data) => _KpisBody(kpis: data),
        ),
        AsyncSection<AgencyPayouts>(
          title: 'Reversements aux propriétaires',
          state: payouts.state,
          onRetry: payouts.load,
          builder: (context, data) => _PayoutsBody(payouts: data),
        ),
        AsyncSection<AgencyAlerts>(
          title: 'À surveiller',
          state: alerts.state,
          onRetry: alerts.load,
          builder: (context, data) => _AlertsBody(alerts: data),
        ),
        NavTile(
          icon: Icons.warning_amber_rounded,
          title: 'Impayés',
          subtitle: 'Échéances et factures en retard',
          onTap: () =>
              Navigator.pushNamed<Object?>(context, RouteName.agencyUnpaid),
        ),
        NavTile(
          icon: Icons.build_circle_outlined,
          title: 'Interventions',
          subtitle: 'À qualifier, devis à approuver, en cours',
          onTap: () => Navigator.pushNamed<Object?>(
            context,
            RouteName.agencyInterventions,
          ),
        ),
        NavTile(
          icon: Icons.apartment_rounded,
          title: 'Portefeuille',
          subtitle: 'Biens et baux',
          onTap: () =>
              Navigator.pushNamed<Object?>(context, RouteName.agencyPortfolio),
        ),
        const ComingSoonCard(items: comingSoon),
      ],
    );
  }
}

class const _KpisBody({required final AgencyKpis kpis})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          spacing: AppSpacing.sm,
          children: [
            StatusPill(
              label: kpis.periodClosed ? 'Période clôturée' : 'Période ouverte',
              tone: kpis.periodClosed ? PillTone.success : PillTone.info,
            ),
          ],
        ),
        KeyValueRow(
          label: 'Période',
          value: Formatters.monthYear(kpis.monthStart),
        ),
        KeyValueRow(label: 'Loyers appelés', value: kpis.rentCalled.text),
        KeyValueRow(label: 'Loyers encaissés', value: kpis.rentCollected.text),
        KeyValueRow(
          label: 'Taux d’encaissement',
          value: kpis.collectionRateText ?? 'Aucun loyer appelé',
          emphasized: true,
        ),
        KeyValueRow(label: 'Honoraires nets', value: kpis.feesNet.text),
      ],
    );
  }
}

class const _PayoutsBody({required final AgencyPayouts payouts})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        KeyValueRow(
          label: 'À reverser',
          value: payouts.payableTotal.text,
          emphasized: true,
        ),
        KeyValueRow(label: 'En transit', value: payouts.inTransitTotal.text),
        KeyValueRow(
          label: 'Propriétaires concernés',
          value: '${payouts.mandantsWithPayable}',
        ),
        KeyValueRow(
          label: 'Reversements en attente',
          value: '${payouts.pendingItems}',
        ),
        if (payouts.activeHolds > 0)
          KeyValueRow(
            label: 'Retenues actives',
            value: '${payouts.activeHolds}',
          ),
        if (payouts.topMandants.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Plus gros montants à reverser',
            style: theme.textTheme.titleSmall,
          ),
          for (final mandant in payouts.topMandants)
            KeyValueRow(
              label: mandant.name ?? 'Propriétaire sans nom',
              value: mandant.payable.text,
            ),
        ],
      ],
    );
  }
}

class const _AlertsBody({required final AgencyAlerts alerts})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodyMedium?.copyWith(
      color: context.palette.textMuted,
    );
    final nothing =
        alerts.mandatesToRenewCount == 0 &&
        alerts.certificatesToRenew == 0 &&
        alerts.reportsDue == 0;
    if (nothing) {
      return Text('Rien à signaler pour le moment.', style: muted);
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (alerts.mandatesToRenewCount > 0) ...[
          KeyValueRow(
            label: 'Mandats à renouveler',
            value: '${alerts.mandatesToRenewCount}',
            emphasized: true,
          ),
          for (final mandate in alerts.mandatesToRenew)
            Text(
              '${mandate.reference} · échéance le ${Formatters.dateLong(mandate.endsOn)}',
              style: muted,
            ),
        ],
        if (alerts.certificatesToRenew > 0)
          KeyValueRow(
            label: 'Certificats à renouveler',
            value: '${alerts.certificatesToRenew}',
          ),
        if (alerts.reportsDue > 0)
          KeyValueRow(
            label: 'Comptes rendus à publier',
            value:
                '${alerts.reportsDue} (${Formatters.dateRange(alerts.reportsPeriodStart, alerts.reportsPeriodEnd)})',
          ),
      ],
    );
  }
}
