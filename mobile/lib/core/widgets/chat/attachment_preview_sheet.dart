import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../services/api_client.dart';
import '../../services/api_exception.dart';
import '../../services/app_logger.dart';
import '../../services/file_rejected_exception.dart';
import '../../state/async_view_model.dart';
import '../../theme/app_spacing.dart';
import '../../utils/api_error_text.dart';
import '../../utils/formatters.dart';
import '../../utils/image_header.dart';
import '../app_button.dart';
import '../app_sheet.dart';
import '../inline_message.dart';
import '../status_pill.dart';

typedef AttachmentLoader = Future<Uint8List> Function();

/// Aperçu d'une pièce jointe. Seules les images s'affichent, après un
/// téléchargement authentifié ; tout autre type (PDF) n'est ni téléchargé ni
/// ouvert, l'écran le dit.
Future<void> showAttachmentPreview(
  BuildContext context, {
  required String name,
  required String mimeType,
  required int sizeBytes,
  required AttachmentLoader load,
}) => showAppSheet<void>(
  context,
  builder: (_) => AttachmentPreview(
    name: name,
    mimeType: mimeType,
    sizeBytes: sizeBytes,
    load: load,
  ),
);

class const AttachmentPreview({
  super.key,
  required final String name,
  required final String mimeType,
  required final int sizeBytes,
  required final AttachmentLoader load,
  final AppLogger logger = const AppLogger(),
}) extends StatefulWidget {
  static const previewableTypes = {'image/jpeg', 'image/png', 'image/webp'};
  static const maxPreviewBytes = ApiClient.defaultMaxDownloadBytes;
  static const unreadableImage = 'Cette image ne peut pas être affichée.';
  static const oversizedImage =
      'Cette image est trop grande pour être affichée dans l’application.';

  @override
  State<AttachmentPreview> createState() => _AttachmentPreviewState();
}

class _AttachmentPreviewState() extends State<AttachmentPreview> {
  Uint8List? _bytes;
  String? _error;
  String? _rejection;
  bool _loading = false;

  bool get _previewable =>
      AttachmentPreview.previewableTypes.contains(widget.mimeType) &&
      widget.sizeBytes <= AttachmentPreview.maxPreviewBytes;

  @override
  void initState() {
    super.initState();
    if (_previewable) _fetch();
  }

  Future<void> _fetch() async {
    setState(() {
      _loading = true;
      _error = null;
      _rejection = null;
    });
    String? error;
    String? rejection;
    Uint8List? bytes;
    try {
      bytes = await widget.load();
      rejection = _inspect(bytes);
      if (rejection != null) bytes = null;
    } on FileRejectedException catch (failure) {
      rejection = failure.message;
    } on ApiException catch (failure) {
      error = ApiErrorText.of(failure);
    } on Exception catch (failure, stack) {
      widget.logger.error(
        'Aperçu de pièce jointe impossible',
        error: failure,
        stack: stack,
      );
      error = AsyncViewModel.genericFailure;
    }
    if (!mounted) return;
    setState(() {
      _bytes = bytes;
      _error = error;
      _rejection = rejection;
      _loading = false;
    });
  }

  String? _inspect(Uint8List bytes) {
    if (bytes.length > AttachmentPreview.maxPreviewBytes) {
      return AttachmentPreview.oversizedImage;
    }
    final header = ImageHeaders.parse(bytes);
    if (header == null || header.format.mimeType != widget.mimeType) {
      return AttachmentPreview.unreadableImage;
    }
    return header.pixels > ImageHeaders.maxPixels
        ? AttachmentPreview.oversizedImage
        : null;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bytes = _bytes;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          header: true,
          child: Text(widget.name, style: theme.textTheme.titleMedium),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          Formatters.fileSize(widget.sizeBytes),
          style: theme.textTheme.bodySmall,
        ),
        const SizedBox(height: AppSpacing.lg),
        if (!_previewable)
          InlineMessage(
            tone: PillTone.info,
            message: 'Aperçu indisponible dans l’application pour ce type de fichier. Ouvrez la pièce jointe depuis le site.',
          )
        else if (_loading)
          Center(
            child: Semantics(
              label: 'Chargement de la pièce jointe',
              child: const CircularProgressIndicator(),
            ),
          )
        else if (_rejection != null)
          InlineMessage(message: _rejection!)
        else if (_error != null) ...[
          InlineMessage(message: _error!),
          const SizedBox(height: AppSpacing.md),
          AppButton(
            label: 'Réessayer',
            style: AppButtonStyle.outline,
            onPressed: _fetch,
          ),
        ] else if (bytes != null)
          Semantics(
            image: true,
            label: 'Aperçu de ${widget.name}',
            child: ClipRRect(
              borderRadius: BorderRadius.circular(AppSpacing.sm),
              child: Image.memory(
                bytes,
                fit: BoxFit.contain,
                cacheWidth: 1600,
                errorBuilder: (context, error, stack) => const InlineMessage(
                  message: AttachmentPreview.unreadableImage,
                ),
              ),
            ),
          ),
        const SizedBox(height: AppSpacing.lg),
        AppButton(
          label: 'Fermer',
          style: AppButtonStyle.outline,
          onPressed: () => Navigator.of(context).pop(),
        ),
      ],
    );
  }
}
