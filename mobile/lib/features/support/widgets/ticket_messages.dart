import 'package:flutter/material.dart';

import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/chat/attachment_chip.dart';
import '../../../core/widgets/chat/attachment_preview_sheet.dart';
import '../../../core/widgets/chat/chat_bubble.dart';
import '../../../core/widgets/inline_message.dart';
import '../../../core/widgets/status_pill.dart';
import '../models/ticket.dart';
import '../models/ticket_message.dart';
import '../viewmodels/ticket_viewmodel.dart';
import 'ticket_tile.dart';

class const TicketMessages({
  super.key,
  required final TicketViewModel viewModel,
  required final TicketDetail detail,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final messages = detail.messages;
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
          child: _Message(viewModel: viewModel, message: message),
        );
      },
    );
  }
}

class const _Message({
  required final TicketViewModel viewModel,
  required final TicketMessage message,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return ChatBubble(
      author: message.fromSupport ? message.authorName : 'Vous',
      body: message.body,
      sentAt: message.sentAt,
      mine: !message.fromSupport,
      attachments: [
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
  required final TicketViewModel viewModel,
  required final TicketDetail detail,
}) extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final summary = detail.summary;
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
            [
              summary.reference,
              summary.category.label,
              ?summary.organizationName,
            ].join(' · '),
            style: theme.textTheme.bodyMedium?.copyWith(
              color: context.palette.textMuted,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          StatusPill(
            label: summary.status.label,
            tone: ticketTone(summary.status),
          ),
          if (detail.hasMore) ...[
            const SizedBox(height: AppSpacing.md),
            const InlineMessage(
              tone: PillTone.info,
              message: 'Seuls les 200 derniers messages de cette demande sont affichés.',
            ),
          ],
          if (viewModel.pollNotice != null) ...[
            const SizedBox(height: AppSpacing.md),
            InlineMessage(
              tone: PillTone.warning,
              message:
                  'Actualisation automatique en pause. ${viewModel.pollNotice}',
            ),
          ],
        ],
      ),
    );
  }
}
