import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_choice_chip.dart';
import '../../../core/widgets/inline_message.dart';
import '../../../core/widgets/status_pill.dart';
import '../models/owner_access.dart';
import '../viewmodels/owner_access_viewmodel.dart';

class const AgencySelector({super.key}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final access = context.watch<OwnerAccessViewModel>();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(
          header: true,
          child: Text('Agence', style: Theme.of(context).textTheme.titleMedium),
        ),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            for (final item in access.accesses)
              AppChoiceChip(
                label: item.label,
                selected: item.accessId == access.selected?.accessId,
                onSelected: () => access.select(item),
              ),
          ],
        ),
      ],
    );
  }
}

class const AccessLine({super.key}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final selected = context.watch<OwnerAccessViewModel>().selected;
    if (selected == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.screenGutter,
        AppSpacing.md,
        AppSpacing.screenGutter,
        AppSpacing.sm,
      ),
      child: Align(
        alignment: Alignment.centerLeft,
        child: Text(
          selected.label,
          style: Theme.of(context).textTheme.bodyMedium
              ?.copyWith(color: context.palette.textMuted),
        ),
      ),
    );
  }
}

class const AccessNotice({super.key, required final OwnerAccess access})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final until = access.accessUntil;
    final messages = [
      if (access.inGrace)
        until == null
            ? 'Votre mandat est terminé : l’accès est maintenu pour une période limitée.'
            : 'Votre mandat est terminé : l’accès est maintenu jusqu’au ${Formatters.dateLong(until)}.',
      if (access.readOnly) 'Accès en lecture seule.',
    ];
    if (messages.isEmpty) return const SizedBox.shrink();
    return InlineMessage(message: messages.join(' '), tone: PillTone.info);
  }
}
