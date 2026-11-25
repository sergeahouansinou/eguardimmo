import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_choice_chip.dart';
import '../../../core/widgets/async_body.dart';
import '../../auth/widgets/session_gate.dart';
import '../models/booking.dart';
import '../viewmodels/bookings_viewmodel.dart';
import '../widgets/booking_card.dart';
import '../widgets/cancel_sheet.dart';

class const StaysScreen({super.key}) extends StatefulWidget {
  @override
  State<StaysScreen> createState() => _StaysScreenState();
}

class _StaysScreenState() extends State<StaysScreen> {
  bool _showUpcoming = true;

  Future<void> _cancel(BookingsViewModel viewModel, Booking booking) async {
    final messenger = ScaffoldMessenger.of(context);
    if (!await confirmCancellation(context, booking)) return;
    final outcome = await viewModel.cancel(booking);
    final refund = outcome.refund;
    messenger.showSnackBar(
      SnackBar(
        content: Text(
          outcome.error ??
              (refund == null
                  ? 'Réservation annulée.'
                  : 'Réservation annulée. Remboursement calculé : ${Formatters.money(refund.minor, currency: refund.currency)}.'),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            ColoredBox(
              color: p.navBackground,
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.screenGutter),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Semantics(
                      header: true,
                      child: Text(
                        'Mes réservations',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: p.navText,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    ChipRow(
                      children: [
                        AppChoiceChip(
                          label: 'À venir',
                          selected: _showUpcoming,
                          onNavigation: true,
                          onSelected: () =>
                              setState(() => _showUpcoming = true),
                        ),
                        AppChoiceChip(
                          label: 'Passées',
                          selected: !_showUpcoming,
                          onNavigation: true,
                          onSelected: () =>
                              setState(() => _showUpcoming = false),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            Expanded(
              child: SessionGate(
                signedOutMessage:
                    'Connectez-vous pour retrouver vos réservations.',
                builder: (context, _) =>
                    _Bookings(showUpcoming: _showUpcoming, onCancel: _cancel),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class const _Bookings({
  required final bool showUpcoming,
  required final Future<void> Function(
    BookingsViewModel viewModel,
    Booking booking,
  )
  onCancel,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final viewModel = context.watch<BookingsViewModel>();
    return RefreshIndicator(
      onRefresh: viewModel.load,
      child: AsyncBody<List<Booking>>(
        state: viewModel.state,
        onRetry: viewModel.load,
        isEmpty: (_) =>
            (showUpcoming ? viewModel.upcoming : viewModel.past).isEmpty,
        emptyMessage: 'Aucune réservation dans cette liste.',
        builder: (context, _) {
          final bookings = showUpcoming ? viewModel.upcoming : viewModel.past;
          return ListView.separated(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(AppSpacing.screenGutter),
            itemCount: bookings.length,
            separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.md),
            itemBuilder: (context, index) {
              final booking = bookings[index];
              return BookingCard(
                booking: booking,
                canCancel: booking.canCancel(viewModel.today),
                cancelling: viewModel.isCancelling(booking.id),
                onCancel: () => onCancel(viewModel, booking),
              );
            },
          );
        },
      ),
    );
  }
}
