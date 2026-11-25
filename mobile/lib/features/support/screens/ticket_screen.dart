import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/widgets/active_polling.dart';
import '../../../core/widgets/async_body.dart';
import '../models/ticket.dart';
import '../viewmodels/ticket_viewmodel.dart';
import '../widgets/ticket_composer_area.dart';
import '../widgets/ticket_messages.dart';

class const TicketScreen({super.key}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final viewModel = context.watch<TicketViewModel>();
    final detail = viewModel.state.dataOrNull;
    return ActivePolling(
      onActiveChanged: viewModel.setActive,
      child: Scaffold(
        appBar: AppBar(title: const Text('Demande')),
        body: SafeArea(
          bottom: false,
          child: Column(
            children: [
              Expanded(
                child: AsyncBody<TicketDetail>(
                  state: viewModel.state,
                  onRetry: viewModel.load,
                  builder: (context, detail) =>
                      TicketMessages(viewModel: viewModel, detail: detail),
                ),
              ),
              if (detail != null)
                TicketComposerArea(
                  viewModel: viewModel,
                  resolved: detail.summary.isResolved,
                ),
            ],
          ),
        ),
      ),
    );
  }
}
