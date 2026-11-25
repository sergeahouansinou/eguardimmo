import 'package:flutter/material.dart';

import '../../theme/app_palette.dart';
import '../../theme/app_radius.dart';
import '../../theme/app_spacing.dart';
import '../../utils/formatters.dart';

/// Pièce jointe d'un message : nom, taille, type. Ouvre l'aperçu au toucher ;
/// le fichier n'est jamais exécuté.
class const AttachmentChip({
  super.key,
  required final String name,
  required final int sizeBytes,
  required final String mimeType,
  required final VoidCallback onOpen,
}) extends StatelessWidget {
  bool get isImage => mimeType.startsWith('image/');

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final size = Formatters.fileSize(sizeBytes);
    return Semantics(
      button: true,
      label: 'Pièce jointe $name, $size. Voir l’aperçu',
      excludeSemantics: true,
      child: Material(
        color: p.surface,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.field,
          side: BorderSide(color: p.borderStrong),
        ),
        child: InkWell(
          customBorder: RoundedRectangleBorder(borderRadius: AppRadius.field),
          onTap: onOpen,
          child: ConstrainedBox(
            constraints: const BoxConstraints(
              minHeight: AppSpacing.minTapTarget,
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.sm,
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    isImage
                        ? Icons.image_outlined
                        : Icons.insert_drive_file_outlined,
                    color: p.textMuted,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Flexible(
                    child: Text(
                      '$name ($size)',
                      overflow: TextOverflow.ellipsis,
                      maxLines: 2,
                      style: Theme.of(context).textTheme.labelLarge,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
