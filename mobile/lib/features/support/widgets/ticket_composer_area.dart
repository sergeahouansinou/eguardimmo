import 'package:flutter/material.dart';

import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/chat/chat_composer.dart';
import '../support_copy.dart';
import '../viewmodels/ticket_viewmodel.dart';

class const TicketComposerArea({
  super.key,
  required final TicketViewModel viewModel,
  required final bool resolved,
}) extends StatefulWidget {
  @override
  State<TicketComposerArea> createState() => _TicketComposerAreaState();
}

class _TicketComposerAreaState() extends State<TicketComposerArea> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final sent = await widget.viewModel.send(_controller.text);
    if (sent && mounted) _controller.clear();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (widget.resolved)
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.screenGutter,
              vertical: AppSpacing.xs,
            ),
            child: Text(
              supportReopenText,
              style: Theme.of(context).textTheme.bodySmall
                  ?.copyWith(color: context.palette.textMuted),
            ),
          ),
        ChatComposer(
          controller: _controller,
          onSend: _send,
          sending: widget.viewModel.sending,
          error: widget.viewModel.sendError,
          placeholder: 'Écrivez votre réponse au support',
        ),
      ],
    );
  }
}
