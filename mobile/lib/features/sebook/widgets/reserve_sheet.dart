import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/routes/app_routes.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_icon_button.dart';
import '../../../core/widgets/app_sheet.dart';
import '../../../core/widgets/inline_message.dart';
import '../../../core/widgets/status_pill.dart';
import '../models/listing.dart';
import '../models/money.dart';
import '../models/quote.dart';
import '../services/bookings_service.dart';
import '../services/marketplace_service.dart';
import '../viewmodels/bookings_viewmodel.dart';
import '../viewmodels/reserve_viewmodel.dart';

Future<void> showReserveSheet(
  BuildContext context, {
  required ListingDetail listing,
}) {
  final market = context.read<MarketplaceService>();
  final bookings = context.read<BookingsService>();
  final router = GoRouter.of(context);
  final stays = context.read<BookingsViewModel>();
  return showAppSheet<void>(
    context,
    builder: (_) => ChangeNotifierProvider(
      create: (_) {
        final viewModel = ReserveViewModel(market, bookings, listing);
        unawaited(viewModel.loadAvailability());
        return viewModel;
      },
      child: ReserveSheet(
        onSeeStays: () {
          unawaited(stays.load());
          router.go(AppRoutes.stays);
        },
      ),
    ),
  );
}

class const ReserveSheet({super.key, required final VoidCallback onSeeStays})
    extends StatelessWidget {
  static const unavailablePayment =
      'Le paiement en ligne n’est pas encore disponible dans l’application : '
      'la réservation sera créée avec le statut « Paiement à finaliser ».';

  Future<void> _pickDates(
    BuildContext context,
    ReserveViewModel viewModel,
  ) async {
    final picked = await showDateRangePicker(
      context: context,
      firstDate: viewModel.firstDay,
      lastDate: viewModel.lastDay,
      initialDateRange: viewModel.range,
      helpText: 'Choisir les dates du séjour',
      saveText: 'Valider',
    );
    if (picked != null) await viewModel.setRange(picked);
  }

  @override
  Widget build(BuildContext context) {
    final viewModel = context.watch<ReserveViewModel>();
    final theme = Theme.of(context);
    final listing = viewModel.listing.summary;
    if (viewModel.created) {
      return Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Réservation créée', style: theme.textTheme.titleLarge),
          const SizedBox(height: AppSpacing.md),
          const Align(
            alignment: Alignment.centerLeft,
            child: StatusPill(
              label: 'Paiement à finaliser',
              tone: PillTone.warning,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            'Votre réservation n’est pas confirmée : elle le sera quand le paiement aura été reçu. '
            'Le paiement en ligne n’est pas encore ouvert dans l’application.',
            style: theme.textTheme.bodyLarge,
          ),
          const SizedBox(height: AppSpacing.lg),
          AppButton(
            label: 'Voir mes séjours',
            expanded: true,
            onPressed: () {
              Navigator.of(context).pop();
              onSeeStays();
            },
          ),
        ],
      );
    }
    final range = viewModel.range;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          header: true,
          child: Text('Réserver', style: theme.textTheme.titleLarge),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(listing.title, style: theme.textTheme.bodyMedium),
        const SizedBox(height: AppSpacing.lg),
        AppButton(
          label: range == null
              ? 'Choisir les dates'
              : Formatters.dateRange(range.start, range.end),
          style: AppButtonStyle.outline,
          expanded: true,
          onPressed: () => _pickDates(context, viewModel),
        ),
        const SizedBox(height: AppSpacing.md),
        if (viewModel.occupied.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
          _OccupiedNote(ranges: viewModel.occupied),
        ],
        if (viewModel.availabilityNotice != null) ...[
          const SizedBox(height: AppSpacing.sm),
          InlineMessage(
            message: viewModel.availabilityNotice!,
            tone: PillTone.warning,
          ),
        ],
        const SizedBox(height: AppSpacing.md),
        _GuestStepper(viewModel: viewModel),
        const SizedBox(height: AppSpacing.md),
        if (viewModel.quoting)
          Center(
            child: Semantics(
              label: 'Calcul du prix',
              child: CircularProgressIndicator(),
            ),
          )
        else if (viewModel.quote != null)
          _QuoteLines(quote: viewModel.quote!),
        if (viewModel.error != null) ...[
          const SizedBox(height: AppSpacing.md),
          InlineMessage(message: viewModel.error!),
        ],
        const SizedBox(height: AppSpacing.md),
        const InlineMessage(message: unavailablePayment, tone: PillTone.info),
        const SizedBox(height: AppSpacing.lg),
        AppButton(
          label: 'Réserver',
          expanded: true,
          loading: viewModel.booking,
          onPressed: viewModel.canConfirm ? viewModel.confirm : null,
        ),
      ],
    );
  }
}

class const _GuestStepper({required final ReserveViewModel viewModel})
    extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final guests = viewModel.guests;
    return Row(
      children: [
        Expanded(
          child: Text(
            'Voyageurs (${viewModel.maxGuests} maximum)',
            style: Theme.of(context).textTheme.labelLarge,
          ),
        ),
        AppIconButton(
          icon: Icons.remove_rounded,
          tooltip: 'Un voyageur de moins',
          onPressed: guests > 1 ? () => viewModel.setGuests(guests - 1) : null,
        ),
        Semantics(
          label: '$guests voyageur${guests > 1 ? 's' : ''}',
          excludeSemantics: true,
          child: SizedBox(
            width: AppSpacing.xxl,
            child: Text(
              '$guests',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ),
        ),
        AppIconButton(
          icon: Icons.add_rounded,
          tooltip: 'Un voyageur de plus',
          onPressed: guests < viewModel.maxGuests
              ? () => viewModel.setGuests(guests + 1)
              : null,
        ),
      ],
    );
  }
}

class const _QuoteLines({required final Quote quote}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    String money(Money amount) =>
        Formatters.money(amount.minor, currency: amount.currency);
    Widget line(String label, String value, {bool strong = false}) => Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(
              label,
              style: strong
                  ? theme.textTheme.titleSmall
                  : theme.textTheme.bodyMedium,
            ),
          ),
          Text(
            value,
            style: strong
                ? theme.textTheme.titleSmall
                : theme.textTheme.bodyMedium,
          ),
        ],
      ),
    );
    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border.all(color: context.palette.border),
        borderRadius: BorderRadius.circular(AppSpacing.sm),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          children: [
            line(
              '${money(quote.nightly)} × ${quote.nights} nuit${quote.nights > 1 ? 's' : ''}',
              money(quote.subtotal),
            ),
            if (quote.serviceFee.minor > 0)
              line('Frais de service', money(quote.serviceFee)),
            line('Total', money(quote.total), strong: true),
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.xs),
              child: Text(
                quote.cancellationPolicy.description,
                style: theme.textTheme.bodySmall,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class const _OccupiedNote({required final List<OccupiedRange> ranges})
    extends StatelessWidget {
  static const _shown = 4;

  @override
  Widget build(BuildContext context) {
    final shown = ranges.take(_shown);
    final more = ranges.length - shown.length;
    final text = [
      for (final taken in shown)
        Formatters.dateRange(taken.checkIn, taken.checkOut),
    ].join(' ; ');
    return Text(
      'Déjà réservé : $text${more > 0 ? ' et $more autre${more > 1 ? 's' : ''}' : ''}.',
      style: Theme.of(context).textTheme.bodySmall,
    );
  }
}
