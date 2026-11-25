import 'package:flutter/material.dart';

import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_sheet.dart';
import '../models/booking.dart';

/// Confirmation d'annulation : renvoie true quand l'utilisateur confirme.
Future<bool> confirmCancellation(BuildContext context, Booking booking) async {
  final confirmed = await showAppSheet<bool>(
    context,
    builder: (sheetContext) => Semantics(
      scopesRoute: true,
      explicitChildNodes: true,
      child: _CancelSheet(booking: booking),
    ),
  );
  return confirmed ?? false;
}

class const _CancelSheet({required final Booking booking})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          header: true,
          child: Text(
            'Annuler cette réservation ?',
            style: theme.textTheme.titleLarge,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          '${booking.listing?.title ?? 'Réservation ${booking.reference}'}, ${Formatters.dateRange(booking.checkIn, booking.checkOut)}. ${booking.cancellationPolicy.description}',
          style: theme.textTheme.bodyLarge,
        ),
        const SizedBox(height: AppSpacing.lg),
        AppButton(
          label: 'Annuler la réservation',
          style: AppButtonStyle.danger,
          expanded: true,
          onPressed: () => Navigator.of(context).pop(true),
        ),
        const SizedBox(height: AppSpacing.sm),
        AppButton(
          label: 'Conserver',
          style: AppButtonStyle.outline,
          expanded: true,
          onPressed: () => Navigator.of(context).pop(false),
        ),
      ],
    );
  }
}
