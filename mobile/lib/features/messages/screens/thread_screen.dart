import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/widgets/active_polling.dart';
import '../../../core/widgets/async_body.dart';
import '../models/thread.dart';
import '../viewmodels/thread_viewmodel.dart';
import '../widgets/thread_composer_area.dart';
import '../widgets/thread_messages.dart';

class const ThreadScreen({super.key}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final viewModel = context.watch<ThreadViewModel>();
    final detail = viewModel.state.dataOrNull;
    final closed = detail?.summary.isClosed ?? false;
    return ActivePolling(
      onActiveChanged: viewModel.setActive,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Conversation'),
          actions: [
            if (detail != null && viewModel.scope.canCloseThread)
              IconButton(
                tooltip: closed
                    ? 'Rouvrir la conversation'
                    : 'Fermer la conversation',
                icon: Icon(
                  closed ? Icons.lock_open_rounded : Icons.lock_outline_rounded,
                ),
                onPressed: viewModel.closing
                    ? null
                    : () => viewModel.setClosed(closed: !closed),
              ),
          ],
        ),
        body: SafeArea(
          bottom: false,
          child: Column(
            children: [
              Expanded(
                child: AsyncBody<ThreadDetail>(
                  state: viewModel.state,
                  onRetry: viewModel.load,
                  builder: (context, detail) =>
                      ThreadMessages(viewModel: viewModel, detail: detail),
                ),
              ),
              if (detail != null)
                ThreadComposerArea(
                  viewModel: viewModel,
                  summary: detail.summary,
                ),
            ],
          ),
        ),
      ),
    );
  }
}
