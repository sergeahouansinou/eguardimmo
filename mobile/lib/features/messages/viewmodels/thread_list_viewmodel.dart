import '../../../core/state/list_page.dart';
import '../../../core/state/polled_list_viewmodel.dart';
import '../models/messaging_scope.dart';
import '../models/thread.dart';
import '../services/threads_service.dart';

/// Boîte de conversations du profil actif, interrogée toutes les 30 s tant
/// que l'écran est visible (ADR 0033, décision 3).
class ThreadListViewModel(final ThreadsService _service, {super.logger})
    extends PolledListViewModel<ThreadSummary> {
  MessagingScope? _scope;
  ThreadKind? _kind;
  ThreadFilter _filter = ThreadFilter.all;

  MessagingScope? get scope => _scope;
  ThreadKind? get kind => _kind;
  ThreadFilter get filter => _filter;

  ThreadsEndpoint? get endpoint {
    final scope = _scope;
    return scope == null ? null : ThreadsEndpoint(scope, kind: _kind);
  }

  @override
  bool get enabled => _scope != null;

  void useScope(MessagingScope? scope) {
    if (scope?.key == _scope?.key) return;
    _scope = scope;
    _kind = scope?.kinds.firstOrNull;
    _filter = ThreadFilter.all;
    resetContext();
  }

  @override
  void resetForKeyChange() {
    super.resetForKeyChange();
    _kind = _scope?.kinds.firstOrNull;
    _filter = ThreadFilter.all;
  }

  Future<void> selectKind(ThreadKind kind) async {
    if (kind == _kind) return;
    _kind = kind;
    await load(keepPrevious: false);
  }

  Future<void> selectFilter(ThreadFilter filter) async {
    if (filter == _filter) return;
    _filter = filter;
    await load(keepPrevious: false);
  }

  @override
  Future<ListPage<ThreadSummary>> fetchPage(String? cursor) =>
      _service.list(endpoint!, filter: _filter, cursor: cursor);

  @override
  String idOf(ThreadSummary item) => item.id;

  @override
  DateTime sortKey(ThreadSummary item) => item.lastMessageAt;
}
