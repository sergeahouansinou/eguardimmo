import 'package:flutter/material.dart';

import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/chat/attachment_chip.dart';
import '../../../core/widgets/chat/attachment_preview_sheet.dart';
import '../../../core/widgets/chat/chat_bubble.dart';
import '../../../core/widgets/inline_message.dart';
import '../../../core/widgets/status_pill.dart';
import '../models/thread.dart';
import '../models/thread_message.dart';
import '../viewmodels/thread_viewmodel.dart';

/// Fil en ordre inversé : le plus récent est au bas, collé à la saisie, et
/// l'en-tête (objet, bouton d'historique) se trouve en haut de la liste.
class const ThreadMessages({
  super.key,
  required final ThreadViewModel viewModel,
  required final ThreadDetail detail,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final messages = detail.messages;
    final lastMineId = messages.where((m) => m.mine).lastOrNull?.id;
    return ListView.builder(
      reverse: true,
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(AppSpacing.screenGutter),
      itemCount: messages.length + 1,
      itemBuilder: (context, index) {
        if (index == messages.length) {
          return _Header(viewModel: viewModel, detail: detail);
        }
        final message = messages[messages.length - 1 - index];
        return Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.md),
          child: _Message(
            viewModel: viewModel,
            message: message,
            footnote: message.id == lastMineId
                ? _receipt(detail.summary, message)
                : null,
          ),
        );
      },
    );
  }

  String _receipt(ThreadSummary summary, ThreadMessage message) {
    final readAt = summary.counterpartReadAt;
    final read = readAt != null && !readAt.isBefore(message.sentAt);
    if (!read) return 'Envoyé';
    return viewModel.scope.isStaff ? 'Lu' : 'Lu par l’agence';
  }
}

class const _Message({
  required final ThreadViewModel viewModel,
  required final ThreadMessage message,
  final String? footnote,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return ChatBubble(
      author: message.mine ? 'Vous' : message.authorName,
      body: message.redacted ? 'Message retiré.' : message.body,
      sentAt: message.sentAt,
      mine: message.mine,
      footnote: footnote,
      attachments: message.redacted
          ? const []
          : [
              for (final attachment in message.attachments)
                AttachmentChip(
                  name: attachment.name,
                  sizeBytes: attachment.sizeBytes,
                  mimeType: attachment.mimeType,
                  onOpen: () => showAttachmentPreview(
                    context,
                    name: attachment.name,
                    mimeType: attachment.mimeType,
                    sizeBytes: attachment.sizeBytes,
                    load: () => viewModel.downloadAttachment(attachment),
                  ),
                ),
            ],
    );
  }
}

class const _Header({
  required final ThreadViewModel viewModel,
  required final ThreadDetail detail,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final summary = detail.summary;
    final who = [
      summary.counterpartName ??
          (viewModel.scope.isStaff ? 'Contact' : 'Agence'),
      ?summary.reference,
    ].join(' · ');
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Semantics(
            header: true,
            child: Text(summary.subject, style: theme.textTheme.titleLarge),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            who,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: context.palette.textMuted,
            ),
          ),
          if (summary.isClosed) ...[
            const SizedBox(height: AppSpacing.sm),
            const StatusPill(label: 'Conversation fermée'),
          ],
          if (viewModel.pollNotice != null) ...[
            const SizedBox(height: AppSpacing.md),
            InlineMessage(
              tone: PillTone.warning,
              message:
                  'Actualisation automatique en pause. ${viewModel.pollNotice}',
            ),
          ],
          if (viewModel.actionError != null) ...[
            const SizedBox(height: AppSpacing.md),
            InlineMessage(message: viewModel.actionError!),
          ],
          if (detail.hasEarlier) ...[
            const SizedBox(height: AppSpacing.md),
            AppButton(
              label: 'Afficher les messages précédents',
              style: AppButtonStyle.outline,
              loading: viewModel.loadingEarlier,
              onPressed: viewModel.loadEarlier,
            ),
          ],
        ],
      ),
    );
  }
}
