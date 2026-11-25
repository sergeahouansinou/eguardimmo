import '../../../core/state/list_page.dart';
import '../../../core/state/polled_list_viewmodel.dart';
import '../models/ticket.dart';
import '../services/support_service.dart';

/// Mes demandes d'assistance, actualisées toutes les 30 s tant que l'écran est
/// visible (lecture limitée à 60 par minute côté serveur).
class TicketsViewModel(final SupportService _service, {super.logger})
    extends PolledListViewModel<TicketSummary> {
  @override
  Future<ListPage<TicketSummary>> fetchPage(String? cursor) =>
      _service.tickets(cursor: cursor);

  @override
  String idOf(TicketSummary item) => item.id;

  @override
  DateTime sortKey(TicketSummary item) => item.updatedAt;
}
