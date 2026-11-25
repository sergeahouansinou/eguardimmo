import 'dart:async';
import 'dart:typed_data';

import '../../../core/services/api_exception.dart';
import '../../../core/state/async_view_model.dart';
import '../../../core/utils/api_error_text.dart';
import '../../../core/utils/idempotency_key.dart';
import '../../../core/utils/poller.dart';
import '../models/messaging_scope.dart';
import '../models/thread.dart';
import '../models/thread_message.dart';
import '../services/threads_service.dart';

/// Fil ouvert : messages les plus récents, interrogation toutes les 10 s
/// (`after`), envoi idempotent (`client_id` stable tant que le texte ne change
/// pas) et brouillon conservé quand l'envoi échoue.
class ThreadViewModel(
  final ThreadsService _service,
  final ThreadsEndpoint _endpoint,
  final String threadId, {
  super.logger,
  final Duration pollInterval = const Duration(seconds: 10),
  final String Function() newClientId = IdempotencyKey.generate,
}) extends AsyncViewModel<ThreadDetail> {
  static const _maxCatchUpPages = 5;
  static const _reloadCodes = {
    'conversation_closed',
    'conversation_muted',
    'conversation_read_only',
  };

  Poller? _poller;
  bool _active = false;
  bool _sending = false;
  bool _loadingEarlier = false;
  bool _closing = false;
  String? _pollNotice;
  String? _sendError;
  String? _actionError;
  String? _draft;
  String? _draftClientId;

  MessagingScope get scope => _endpoint.scope;
  bool get sending => _sending;
  bool get loadingEarlier => _loadingEarlier;
  bool get closing => _closing;
  String? get pollNotice => _pollNotice;
  String? get sendError => _sendError;
  String? get actionError => _actionError;

  @override
  String messageFor(ApiException error) => ApiErrorText.of(error);

  @override
  Future<ThreadDetail> fetch() {
    _pollNotice = null;
    return _service.show(_endpoint, threadId);
  }

  @override
  Future<void> load({bool keepPrevious = true}) async {
    await super.load(keepPrevious: keepPrevious);
    if (state.dataOrNull?.summary.unread ?? false) unawaited(_markRead());
  }

  Future<void> loadEarlier() async {
    final current = state.dataOrNull;
    final cursor = current?.earlierCursor;
    if (current == null || cursor == null || _loadingEarlier) return;
    _loadingEarlier = true;
    _actionError = null;
    notifySafely();
    try {
      final page = await _service.messages(_endpoint, threadId, cursor: cursor);
      final latest = state.dataOrNull ?? current;
      final known = {for (final message in latest.messages) message.id};
      replaceData(
        latest.copyWith(
          messages: [
            ...page.items.where((message) => !known.contains(message.id)),
            ...latest.messages,
          ],
          earlierCursor: page.hasMore ? page.nextCursor : null,
          clearEarlier: !page.hasMore,
        ),
      );
    } on ApiException catch (error) {
      _actionError = ApiErrorText.of(error);
    } on Exception catch (error, stack) {
      logger.error('Historique impossible', error: error, stack: stack);
      _actionError = AsyncViewModel.genericFailure;
    } finally {
      _loadingEarlier = false;
      notifySafely();
    }
  }

  /// Renvoie vrai quand le message est parti : l'appelant peut alors vider son
  /// brouillon. Sinon [sendError] dit pourquoi et le texte reste à renvoyer.
  Future<bool> send(String text) async {
    final body = text.trim();
    final current = state.dataOrNull;
    if (_sending || body.isEmpty || current == null) return false;
    if (_draft != body) {
      _draft = body;
      _draftClientId = newClientId();
    }
    _sending = true;
    _sendError = null;
    notifySafely();
    try {
      final message = await _service.post(
        _endpoint,
        threadId,
        body: body,
        clientId: _draftClientId!,
      );
      _draft = null;
      _draftClientId = null;
      _merge([message]);
      return true;
    } on ApiException catch (error) {
      _sendError = ApiErrorText.of(error);
      if (_reloadCodes.contains(error.code)) unawaited(_reloadQuietly());
      return false;
    } on Exception catch (error, stack) {
      logger.error('Envoi impossible', error: error, stack: stack);
      _sendError = AsyncViewModel.genericFailure;
      return false;
    } finally {
      _sending = false;
      notifySafely();
    }
  }

  Future<void> setClosed({required bool closed}) async {
    final current = state.dataOrNull;
    if (current == null || _closing || !scope.canCloseThread) return;
    _closing = true;
    _actionError = null;
    notifySafely();
    try {
      final summary = await _service.setStatus(
        _endpoint,
        threadId,
        closed ? ThreadStatus.closed : ThreadStatus.open,
      );
      final latest = state.dataOrNull ?? current;
      replaceData(
        latest.copyWith(
          summary: latest.summary.copyWith(status: summary.status),
        ),
      );
    } on ApiException catch (error) {
      _actionError = ApiErrorText.of(error);
    } on Exception catch (error, stack) {
      logger.error('Changement d’état impossible', error: error, stack: stack);
      _actionError = AsyncViewModel.genericFailure;
    } finally {
      _closing = false;
      notifySafely();
    }
  }

  Future<Uint8List> downloadAttachment(ThreadAttachment attachment) =>
      _service.downloadAttachment(_endpoint, attachment.id);

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
    var after = current.latest?.id;
    for (var page = 0; page < _maxCatchUpPages; page++) {
      final MessagesPage result;
      try {
        result = await _service.messages(_endpoint, threadId, after: after);
      } on ApiException catch (error) {
        if (error.code == 'message_not_found') {
          await _reloadQuietly();
          return;
        }
        rethrow;
      }
      _pollNotice = null;
      _merge(result.items, page: result);
      if (!result.hasMore || result.items.isEmpty) return;
      after = result.items.last.id;
    }
  }

  void _merge(List<ThreadMessage> incoming, {MessagesPage? page}) {
    final current = state.dataOrNull;
    if (current == null) return;
    final known = {for (final message in current.messages) message.id};
    final added = incoming.where((m) => !known.contains(m.id)).toList();
    var summary = current.summary;
    if (page != null) {
      summary = summary.copyWith(
        status: page.status,
        counterpartReadAt: page.counterpartReadAt,
        canReply: page.canReply,
      );
    }
    if (added.isNotEmpty) {
      final last = added.last;
      summary = summary.copyWith(
        preview: last.body,
        lastMessageAt: last.sentAt,
        lastAuthor: last.side,
        messageCount: summary.messageCount + added.length,
        status: scope.isStaff && last.mine ? ThreadStatus.open : null,
      );
    }
    final fromOthers = added.any((message) => !message.mine);
    if (fromOthers) summary = summary.copyWith(unread: true);
    replaceData(
      current.copyWith(
        summary: summary,
        messages: [...current.messages, ...added],
      ),
    );
    if (fromOthers) unawaited(_markRead());
  }

  Future<void> _markRead() async {
    if (!scope.canMarkRead) return;
    try {
      await _service.markRead(_endpoint, threadId);
      final current = state.dataOrNull;
      if (current != null) {
        replaceData(
          current.copyWith(summary: current.summary.copyWith(unread: false)),
        );
      }
    } on Exception catch (error, stack) {
      logger.error('Marquage comme lu impossible', error: error, stack: stack);
    }
  }

  Future<void> _reloadQuietly() async {
    try {
      final detail = await _service.show(_endpoint, threadId);
      replaceData(detail);
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
