import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/app_choice_chip.dart';
import '../../../core/widgets/async_list_view.dart';
import '../../../core/widgets/sub_page_scaffold.dart';
import '../models/installment.dart';
import '../models/rent_payment.dart';
import '../models/rent_receipt.dart';
import '../tenant_paths.dart';
import '../viewmodels/installments_viewmodel.dart';
import '../viewmodels/rent_history_viewmodels.dart';
import '../widgets/rent_cards.dart';

class const RentScreen({super.key}) extends StatefulWidget {
  @override
  State<RentScreen> createState() => _RentScreenState();
}

class _RentScreenState() extends State<RentScreen> {
  static const _tabs = ['Échéances', 'Paiements', 'Quittances'];
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    return SubPageScaffold(
      title: 'Loyers',
      fallbackRoute: TenantPaths.home,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(AppSpacing.screenGutter),
            child: Align(
              alignment: Alignment.centerLeft,
              child: ChipRow(
                children: [
                  for (var i = 0; i < _tabs.length; i++)
                    AppChoiceChip(
                      label: _tabs[i],
                      selected: _tab == i,
                      onSelected: () => setState(() => _tab = i),
                    ),
                ],
              ),
            ),
          ),
          Expanded(
            child: switch (_tab) {
              0 => const _Installments(),
              1 => const _Payments(),
              _ => const _Receipts(),
            },
          ),
        ],
      ),
    );
  }
}

class const _Installments() extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final viewModel = context.watch<InstallmentsViewModel>();
    return AsyncListView<Installment>(
      state: viewModel.state,
      onRefresh: viewModel.load,
      emptyMessage: 'Aucune échéance appelée pour le moment.',
      itemBuilder: (context, installment) => InstallmentCard(
        installment: installment,
        onTap: () => context.push(TenantPaths.installment(installment.id)),
      ),
    );
  }
}

class const _Payments() extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final viewModel = context.watch<PaymentsViewModel>();
    return AsyncListView<RentPayment>(
      state: viewModel.state,
      onRefresh: viewModel.load,
      emptyMessage: 'Aucun paiement enregistré pour le moment.',
      itemBuilder: (_, payment) => PaymentCard(payment: payment),
    );
  }
}

class const _Receipts() extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final viewModel = context.watch<ReceiptsViewModel>();
    return AsyncListView<RentReceipt>(
      state: viewModel.state,
      onRefresh: viewModel.load,
      emptyMessage: 'Aucune quittance émise pour le moment.',
      footer: 'Le téléchargement des quittances (PDF) n’est pas encore disponible dans l’application.',
      itemBuilder: (_, receipt) => ReceiptCard(receipt: receipt),
    );
  }
}
