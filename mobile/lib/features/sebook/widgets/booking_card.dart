import 'package:flutter/material.dart';

import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/status_pill.dart';
import '../models/booking.dart';

class const BookingCard({
  super.key,
  required final Booking booking,
  required final bool canCancel,
  required final bool cancelling,
  required final VoidCallback onCancel,
}) extends StatelessWidget {
  static PillTone toneOf(BookingStatus status) => switch (status) {
    BookingStatus.pendingPayment => PillTone.warning,
    BookingStatus.confirmed => PillTone.success,
    BookingStatus.cancelled => PillTone.danger,
    BookingStatus.completed => PillTone.neutral,
  };

  static String _pendingNote(DateTime? expiresAt) {
    const base =
        'Le paiement en ligne n’est pas encore ouvert dans l’application.';
    if (expiresAt == null) return base;
    return '$base Sans paiement, les dates sont libérées le ${Formatters.dateTime(expiresAt.toLocal())}.';
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final theme = Theme.of(context);
    final listing = booking.listing;
    final details = [
      Formatters.dateRange(booking.checkIn, booking.checkOut),
      ?listing?.hostName,
    ].join(' · ');
    return DecoratedBox(
      decoration: BoxDecoration(
        color: p.surface,
        borderRadius: AppRadius.card,
        border: Border.all(color: p.border),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.xs,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                StatusPill(
                  label: booking.status.label,
                  tone: toneOf(booking.status),
                ),
                Text(booking.reference, style: theme.textTheme.bodySmall),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              listing?.title ?? 'Annonce indisponible',
              style: theme.textTheme.titleMedium,
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              details,
              style: theme.textTheme.bodyMedium?.copyWith(color: p.textMuted),
            ),
            if (booking.status == BookingStatus.pendingPayment) ...[
              const SizedBox(height: AppSpacing.xs),
              Text(
                _pendingNote(booking.expiresAt),
                style: theme.textTheme.bodySmall,
              ),
            ],
            const SizedBox(height: AppSpacing.md),
            Wrap(
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: AppSpacing.md,
              runSpacing: AppSpacing.sm,
              children: [
                Text(
                  Formatters.money(
                    booking.total.minor,
                    currency: booking.total.currency,
                  ),
                  style: theme.textTheme.titleMedium,
                ),
                if (canCancel)
                  AppButton(
                    label: 'Annuler',
                    style: AppButtonStyle.dangerOutline,
                    loading: cancelling,
                    onPressed: onCancel,
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
