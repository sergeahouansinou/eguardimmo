import 'package:flutter/material.dart';

import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/chat/chat_composer.dart';
import '../../../core/widgets/inline_message.dart';
import '../../../core/widgets/status_pill.dart';
import '../messages_copy.dart';
import '../models/thread.dart';
import '../viewmodels/thread_viewmodel.dart';

/// Bas de l'écran d'un fil : la saisie, ou la raison honnête pour laquelle elle
/// n'est pas proposée (mandant sur mobile, fil fermé ou restreint).
class const ThreadComposerArea({
  super.key,
  required final ThreadViewModel viewModel,
  required final ThreadSummary summary,
}) extends StatefulWidget {
  @override
  State<ThreadComposerArea> createState() => _ThreadComposerAreaState();
}

class _ThreadComposerAreaState() extends State<ThreadComposerArea> {
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

  String? _readOnlyReason() {
    final scope = widget.viewModel.scope;
    final summary = widget.summary;
    if (!scope.canWrite) {
      return 'Sur mobile, cette conversation est en lecture seule. Pour répondre, utilisez le site eGuardImmo.';
    }
    if (scope.isStaff || summary.canReply) return null;
    if (summary.isClosed) {
      return 'Cette conversation est fermée : vous pouvez la relire, sans y répondre.';
    }
    if (summary.mutedUntil != null) {
      return 'L’agence a restreint l’envoi de messages sur cette conversation : vous pouvez encore la lire.';
    }
    return 'Cette conversation est en lecture seule : vous pouvez la relire, sans y répondre.';
  }

  @override
  Widget build(BuildContext context) {
    final reason = _readOnlyReason();
    if (reason != null) {
      return SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: InlineMessage(tone: PillTone.info, message: reason),
        ),
      );
    }
    final scope = widget.viewModel.scope;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (!scope.isStaff)
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.screenGutter,
              vertical: AppSpacing.xs,
            ),
            child: Text(
              notANoticeText,
              style: Theme.of(context).textTheme.bodySmall
                  ?.copyWith(color: context.palette.textMuted),
            ),
          ),
        ChatComposer(
          controller: _controller,
          onSend: _send,
          sending: widget.viewModel.sending,
          error: widget.viewModel.sendError,
          placeholder: 'Écrivez votre réponse',
        ),
      ],
    );
  }
}
