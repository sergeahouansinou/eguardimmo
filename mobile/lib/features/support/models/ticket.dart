import '../../../core/utils/json_reader.dart';
import 'support_enums.dart';
import 'ticket_message.dart';

class const TicketSummary({
  required final String id,
  required final String reference,
  required final String subject,
  required final String? organizationName,
  required final TicketStatus status,
  required final TicketCategory category,
  required final bool handled,
  required final DateTime createdAt,
  required final DateTime updatedAt,
  required final DateTime? requesterLastReadAt,
  required final int messageCount,
}) {
  /// `TicketSummaryResource` : `assignee` n'est qu'un libellé générique, il
  /// indique seulement que la demande est prise en charge.
  factory TicketSummary.fromJson(Map<String, Object?> json) => TicketSummary(
    id: Json.string(json, 'id'),
    reference: Json.string(json, 'reference'),
    subject: Json.string(json, 'subject'),
    organizationName: Json.stringOrNull(json, 'organization'),
    status: TicketStatus.parse(Json.string(json, 'status')),
    category: TicketCategory.parse(Json.string(json, 'category')),
    handled: json['assignee'] != null,
    createdAt: Json.date(json, 'created_at'),
    updatedAt: Json.date(json, 'updated_at'),
    requesterLastReadAt: Json.dateOrNull(json, 'requester_last_read_at'),
    messageCount: Json.integer(json, 'message_count'),
  );

  TicketSummary copyWith({
    TicketStatus? status,
    DateTime? updatedAt,
    DateTime? requesterLastReadAt,
    int? messageCount,
  }) => TicketSummary(
    id: id,
    reference: reference,
    subject: subject,
    organizationName: organizationName,
    status: status ?? this.status,
    category: category,
    handled: handled,
    createdAt: createdAt,
    updatedAt: updatedAt ?? this.updatedAt,
    requesterLastReadAt: requesterLastReadAt ?? this.requesterLastReadAt,
    messageCount: messageCount ?? this.messageCount,
  );

  bool get isResolved => status == TicketStatus.resolved;
}

/// Détail : les 200 derniers messages au plus ; `hasMore` signale qu'il en
/// existe de plus anciens, que l'API ne permet pas de relire.
class const TicketDetail({
  required final TicketSummary summary,
  required final List<TicketMessage> messages,
  required final bool hasMore,
}) {
  factory TicketDetail.fromJson(Map<String, Object?> json) => TicketDetail(
    summary: TicketSummary.fromJson(json),
    messages: [
      for (final entry in Json.list(json['messages'], 'messages'))
        TicketMessage.fromJson(Json.object(entry, 'messages')),
    ],
    hasMore: Json.boolean(json, 'has_more'),
  );

  TicketMessage? get latest => messages.isEmpty ? null : messages.last;

  bool get hasUnreadSupportReply {
    final readAt = summary.requesterLastReadAt;
    return messages.any(
      (message) =>
          message.fromSupport &&
          (readAt == null || message.sentAt.isAfter(readAt)),
    );
  }

  TicketDetail copyWith({
    TicketSummary? summary,
    List<TicketMessage>? messages,
  }) => TicketDetail(
    summary: summary ?? this.summary,
    messages: messages ?? this.messages,
    hasMore: hasMore,
  );
}

class const TicketMessagesPage({
  required final List<TicketMessage> items,
  required final bool hasMore,
  required final TicketStatus status,
  required final DateTime? requesterLastReadAt,
}) {}
