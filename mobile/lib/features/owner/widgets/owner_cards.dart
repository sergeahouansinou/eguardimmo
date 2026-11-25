import 'package:flutter/material.dart';

import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/info_card.dart';
import '../../../core/widgets/status_pill.dart';
import '../models/owner_document.dart';
import '../models/owner_home.dart';
import '../models/owner_payout.dart';
import '../models/owner_statement.dart';
import '../models/owner_unit.dart';

PillTone payoutTone(PayoutStatus status) => switch (status) {
  PayoutStatus.pending => PillTone.info,
  PayoutStatus.paid => PillTone.success,
  PayoutStatus.returned => PillTone.danger,
};

PillTone unitTone(UnitState state) => switch (state) {
  UnitState.occupied => PillTone.success,
  UnitState.late => PillTone.danger,
  UnitState.vacant => PillTone.neutral,
};

class const PayoutCard({super.key, required final OwnerPayout payout})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodyMedium?.copyWith(
      color: context.palette.textMuted,
    );
    final dateLabel = switch (payout.status) {
      PayoutStatus.pending => 'Prévu le',
      PayoutStatus.paid => 'Versé le',
      PayoutStatus.returned => 'Prévu le',
    };
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.xs,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              StatusPill(
                label: payout.status.label,
                tone: payoutTone(payout.status),
              ),
              Text(payout.number, style: theme.textTheme.bodySmall),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(payout.amount.text, style: theme.textTheme.titleLarge),
          if (payout.date case final date?)
            Text('$dateLabel ${Formatters.dateLong(date)}', style: muted),
          if (payout.bankLast4 case final last4?)
            Text('Compte se terminant par $last4', style: muted),
          if (payout.status == PayoutStatus.returned)
            Text(
              'La banque a retourné ce virement : rapprochez-vous de votre agence.',
              style: theme.textTheme.bodySmall,
            ),
        ],
      ),
    );
  }
}

class const UpcomingPayoutCard({
  super.key,
  required final UpcomingPayout upcoming,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Prochain reversement', style: theme.textTheme.titleMedium),
          Text(
            upcoming.date == null
                ? upcoming.agencyName
                : '${upcoming.agencyName} · prévu le ${Formatters.dateLong(upcoming.date!)}',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: context.palette.textMuted,
            ),
          ),
          if (upcoming.notice case final notice?) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(notice, style: theme.textTheme.bodyMedium),
          ],
        ],
      ),
    );
  }
}

class const UnitCard({super.key, required final OwnerUnit unit})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodyMedium?.copyWith(
      color: context.palette.textMuted,
    );
    final details = [
      unit.typeLabel,
      if (unit.floor case final floor?) 'étage $floor',
      if (unit.surfaceHundredths case final surface?)
        '${(surface / 100).toStringAsFixed(surface % 100 == 0 ? 0 : 2).replaceFirst('.', ',')} m²',
    ];
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${unit.propertyName} · ${unit.reference}',
            style: theme.textTheme.titleMedium,
          ),
          Text(details.join(' · '), style: muted),
          Text(unit.address.oneLine, style: muted),
          Text('Agence : ${unit.agencyName}', style: muted),
          if (unit.coveredFrom case final from?)
            Text(
              unit.coveredUntil == null
                  ? 'Sous mandat depuis le ${Formatters.dateLong(from)}'
                  : 'Sous mandat du ${Formatters.dateLong(from)} au ${Formatters.dateLong(unit.coveredUntil!)}',
              style: theme.textTheme.bodySmall,
            ),
        ],
      ),
    );
  }
}

class const HomeUnitTile({super.key, required final HomeUnit unit})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodyMedium?.copyWith(
      color: context.palette.textMuted,
    );
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: MergeSemantics(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.xs,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text(unit.label, style: theme.textTheme.titleSmall),
                StatusPill(label: unit.state.label, tone: unitTone(unit.state)),
              ],
            ),
            if (unit.tenantName case final tenant?)
              Text('Locataire : $tenant', style: muted),
            if (unit.rent case final rent?)
              Text(
                'Loyer ${rent.text} · encaissé ${unit.collected.text}',
                style: muted,
              ),
          ],
        ),
      ),
    );
  }
}

class const DocumentCard({super.key, required final OwnerDocument document})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodyMedium?.copyWith(
      color: context.palette.textMuted,
    );
    final details = [
      ?document.name,
      if (document.sizeBytes case final size?) Formatters.fileSize(size),
    ];
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(document.kindLabel, style: theme.textTheme.titleMedium),
          if (details.isNotEmpty) Text(details.join(' · '), style: muted),
          Text(
            [
              if (document.mandateReference case final ref?) 'Mandat $ref',
              if (document.sharedAt case final shared?)
                'partagé le ${Formatters.dateLong(shared.toLocal())}',
              document.byAgency
                  ? 'déposé par ${document.agencyName}'
                  : 'déposé par vous',
            ].join(' · '),
            style: muted,
          ),
        ],
      ),
    );
  }
}

class const StatementLineCard({super.key, required final StatementLine line})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final p = context.palette;
    final credit = line.credit.minor > 0;
    final amount = credit ? line.credit : line.debit;
    return InfoCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(line.label, style: theme.textTheme.titleSmall),
              ),
              const SizedBox(width: AppSpacing.md),
              Semantics(
                label: '${credit ? 'Crédit' : 'Débit'} ${amount.text}',
                child: ExcludeSemantics(
                  child: Text(
                    '${credit ? '+' : '−'} ${amount.text}',
                    style: theme.textTheme.titleSmall?.copyWith(
                      color: credit ? p.onSuccessSoft : p.onDangerSoft,
                    ),
                  ),
                ),
              ),
            ],
          ),
          Text(
            '${Formatters.dateLong(line.date)} · ${line.sourceLabel} · ${line.reference}',
            style: theme.textTheme.bodySmall?.copyWith(color: p.textMuted),
          ),
          Text(
            'Solde ${line.balance.text}',
            style: theme.textTheme.bodySmall?.copyWith(color: p.textMuted),
          ),
          if (line.isReversal)
            const Padding(
              padding: EdgeInsets.only(top: AppSpacing.xs),
              child: StatusPill(label: 'Annulation'),
            ),
        ],
      ),
    );
  }
}
