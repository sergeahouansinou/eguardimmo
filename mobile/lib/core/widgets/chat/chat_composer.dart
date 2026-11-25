import 'package:flutter/material.dart';

import '../../theme/app_palette.dart';
import '../../theme/app_spacing.dart';
import '../inline_message.dart';

/// Zone de saisie d'un fil. Le brouillon reste dans le contrôleur tant que
/// l'envoi n'a pas réussi : l'appelant ne le vide qu'après un succès.
class const ChatComposer({
  super.key,
  required final TextEditingController controller,
  required final VoidCallback onSend,
  required final bool sending,
  required final String placeholder,
  final String? error,
  final int maxLength = 5000,
}) extends StatelessWidget {
  static const _counterThreshold = 300;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: p.surface,
        border: Border(top: BorderSide(color: p.border)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (error != null) ...[
                InlineMessage(message: error!),
                const SizedBox(height: AppSpacing.sm),
              ],
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: TextField(
                      controller: controller,
                      enabled: !sending,
                      minLines: 1,
                      maxLines: 5,
                      maxLength: maxLength,
                      keyboardType: TextInputType.multiline,
                      textInputAction: TextInputAction.newline,
                      buildCounter:
                          (
                            context, {
                            required currentLength,
                            required isFocused,
                            required maxLength,
                          }) => maxLength! - currentLength > _counterThreshold
                          ? null
                          : Text(
                              '$currentLength / $maxLength',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                      decoration: InputDecoration(hintText: placeholder),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  ValueListenableBuilder<TextEditingValue>(
                    valueListenable: controller,
                    builder: (context, value, _) => IconButton.filled(
                      tooltip: 'Envoyer le message',
                      onPressed: sending || value.text.trim().isEmpty
                          ? null
                          : onSend,
                      style: IconButton.styleFrom(
                        minimumSize: const Size.square(AppSpacing.minTapTarget),
                        backgroundColor: p.primary,
                        foregroundColor: p.onPrimary,
                      ),
                      icon: sending
                          ? SizedBox.square(
                              dimension: AppSpacing.lg,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: p.onPrimary,
                              ),
                            )
                          : const Icon(Icons.send_rounded),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
