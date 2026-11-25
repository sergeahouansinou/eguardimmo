import 'dart:async';
import 'dart:typed_data';

import '../../../core/services/api_exception.dart';
import '../../../core/state/async_view_model.dart';
import '../../../core/utils/api_error_text.dart';
import '../../../core/utils/idempotency_key.dart';
import '../../../core/utils/poller.dart';
import '../models/ticket.dart';
import '../models/ticket_message.dart';
import '../services/support_service.dart';

/// Fil d'une demande : interrogation toutes les 10 s tant qu'elle n'est pas
/// résolue, réponse idempotente et brouillon conservé si l'envoi échoue.
/// Répondre à une demande résolue la rouvre pendant 14 jours (ADR 0033).
class TicketViewModel(
  final SupportService _service,
  final String ticketId, {
  super.logger,
  final Duration pollInterval = const Duration(seconds: 10),
  final String Function() newClientId = IdempotencyKey.generate,
}) extends AsyncViewModel<TicketDetail> {
  static const _maxCatchUpPages = 5;

  Poller? _poller;
  bool _active = false;
  bool _sending = false;
  String? _pollNotice;
  String? _sendError;
  String? _draft;
  String? _draftClientId;

  bool get sending => _sending;
  String? get pollNotice => _pollNotice;
  String? get sendError => _sendError;

  @override
  String messageFor(ApiException error) => ApiErrorText.of(error);

  @override
  Future<TicketDetail> fetch() {
    _pollNotice = null;
    return _service.ticket(ticketId);
  }

  @override
  Future<void> load({bool keepPrevious = true}) async {
    await super.load(keepPrevious: keepPrevious);
    if (state.dataOrNull?.hasUnreadSupportReply ?? false) {
      unawaited(_markRead());
    }
  }

  /// Renvoie vrai quand la réponse est partie : l'appelant peut vider son
  /// brouillon. Sinon [sendError] dit pourquoi et le texte reste à renvoyer.
  Future<bool> send(String text) async {
    final body = text.trim();
    if (_sending || body.isEmpty || state.dataOrNull == null) return false;
    if (_draft != body) {
      _draft = body;
      _draftClientId = newClientId();
    }
    _sending = true;
    _sendError = null;
    notifySafely();
    try {
      final detail = await _service.reply(
        ticketId,
        body: body,
        clientId: _draftClientId!,
      );
      _draft = null;
      _draftClientId = null;
      replaceData(detail);
      return true;
    } on ApiException catch (error) {
      _sendError = ApiErrorText.of(error);
      return false;
    } on Exception catch (error, stack) {
      logger.error('Réponse impossible', error: error, stack: stack);
      _sendError = AsyncViewModel.genericFailure;
      return false;
    } finally {
      _sending = false;
      notifySafely();
    }
  }

  Future<Uint8List> downloadAttachment(TicketAttachment attachment) =>
      _service.downloadAttachment(attachment);

  void setActive(bool active) {
    if (active == _active) return;
    _active = active;
    if (!active) {
      _poller?.stop();
      return;
    }
    final poller = _poller ??= Poller(
      pollInterval,
      _poll,
      onFailure: _onPollFailure,
    );
    poller.start();
  }

  Future<void> _poll() async {
    final current = state.dataOrNull;
    if (current == null || state.isLoading || _sending) return;
    if (current.summary.isResolved) return;
    var after = current.latest?.id;
    for (var page = 0; page < _maxCatchUpPages && after != null; page++) {
      final TicketMessagesPage result;
      try {
        result = await _service.messages(ticketId, after: after);
      } on ApiException catch (error) {
        if (error.code == 'message_not_found') {
          await _reloadQuietly();
          return;
        }
        rethrow;
      }
      _pollNotice = null;
      _merge(result);
      if (!result.hasMore || result.items.isEmpty) return;
      after = result.items.last.id;
    }
  }

  void _merge(TicketMessagesPage page) {
    final current = state.dataOrNull;
    if (current == null) return;
    final known = {for (final message in current.messages) message.id};
    final added = page.items.where((m) => !known.contains(m.id)).toList();
    final summary = current.summary.copyWith(
      status: page.status,
      requesterLastReadAt: page.requesterLastReadAt,
      messageCount: current.summary.messageCount + added.length,
      updatedAt: added.isEmpty ? null : added.last.sentAt,
    );
    replaceData(
      current.copyWith(
        summary: summary,
        messages: [...current.messages, ...added],
      ),
    );
    if (added.any((message) => message.fromSupport)) unawaited(_markRead());
  }

  Future<void> _markRead() async {
    try {
      final detail = await _service.markRead(ticketId);
      final current = state.dataOrNull;
      if (current != null) {
        replaceData(
          current.copyWith(
            summary: current.summary.copyWith(
              requesterLastReadAt: detail.summary.requesterLastReadAt,
            ),
          ),
        );
      }
    } on Exception catch (error, stack) {
      logger.error('Marquage comme lu impossible', error: error, stack: stack);
    }
  }

  Future<void> _reloadQuietly() async {
    try {
      replaceData(await _service.ticket(ticketId));
    } on Exception catch (error, stack) {
      logger.error('Actualisation impossible', error: error, stack: stack);
    }
  }

  void _onPollFailure(Object error, {required bool isFinal}) {
    if (error is ApiException) {
      _pollNotice = ApiErrorText.of(error);
    } else {
      logger.error('Actualisation impossible', error: error);
      _pollNotice = AsyncViewModel.genericFailure;
    }
    notifySafely();
  }

  @override
  void dispose() {
    _poller?.stop();
    super.dispose();
  }
}
