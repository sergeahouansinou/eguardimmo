import '../../../core/utils/json_reader.dart';
import 'thread_message.dart';

enum ThreadStatus(final String wire, final String label) {
  open('open', 'Ouverte'),
  closed('closed', 'Fermée');

  static ThreadStatus parse(String value) => values.firstWhere(
    (status) => status.wire == value,
    orElse: () => throw FormatException('« status » inconnu : $value'),
  );
}

class const ThreadSummary({
  required final String id,
  required final String subject,
  required final ThreadStatus status,
  required final String? counterpartName,
  required final String? reference,
  required final String preview,
  required final DateTime lastMessageAt,
  required final MessageSide lastAuthor,
  required final bool unread,
  required final bool awaitingReply,
  required final int messageCount,
  required final bool hasAttachments,
  required final DateTime? counterpartReadAt,
  required final DateTime? mutedUntil,
  required final bool canReply,
}) {
  /// `CounterpartThreadResource` (locataire et mandant) : l'agence est le nom
  /// affiché, `can_reply` vient du serveur (fil fermé, restreint, mandat
  /// terminé).
  factory ThreadSummary.fromCounterpart(Map<String, Object?> json) {
    final agency = Json.child(json, 'agency');
    final lease = Json.childOrNull(json, 'lease');
    final mandate = Json.childOrNull(json, 'mandate');
    final lastAuthor = Json.string(json, 'last_author');
    return ThreadSummary(
      id: Json.string(json, 'id'),
      subject: Json.string(json, 'subject'),
      status: ThreadStatus.parse(Json.string(json, 'status')),
      counterpartName: Json.stringOrNull(agency, 'name'),
      reference: lease != null
          ? _reference('Bail', Json.stringOrNull(lease, 'reference'))
          : mandate != null
          ? _reference('Mandat', Json.stringOrNull(mandate, 'reference'))
          : null,
      preview: Json.string(json, 'preview'),
      lastMessageAt: Json.date(json, 'last_message_at'),
      lastAuthor: switch (lastAuthor) {
        'agency' => MessageSide.team,
        'me' => MessageSide.me,
        'other' => MessageSide.counterpart,
        final other => throw FormatException(
          '« last_author » inconnu : $other',
        ),
      },
      unread: Json.boolean(json, 'unread'),
      awaitingReply: false,
      messageCount: Json.integer(json, 'message_count'),
      hasAttachments: Json.boolean(json, 'has_attachments'),
      counterpartReadAt: Json.dateOrNull(json, 'agency_last_read_at'),
      mutedUntil: Json.dateOrNull(json, 'muted_until'),
      canReply: Json.boolean(json, 'can_reply'),
    );
  }

  /// `ExternalThreadResource` (équipe d'une organisation) : la contrepartie
  /// est la fiche locataire ou mandant ; le serveur ne fournit pas `can_reply`
  /// et répond lui-même aux refus (rôle, abonnement).
  factory ThreadSummary.fromStaff(Map<String, Object?> json) {
    final party = Json.child(json, 'party');
    final lease = Json.childOrNull(json, 'lease');
    final mandate = Json.childOrNull(json, 'mandate');
    return ThreadSummary(
      id: Json.string(json, 'id'),
      subject: Json.string(json, 'subject'),
      status: ThreadStatus.parse(Json.string(json, 'status')),
      counterpartName: Json.stringOrNull(party, 'name'),
      reference: lease != null
          ? _reference('Bail', Json.stringOrNull(lease, 'reference'))
          : mandate != null
          ? _reference('Mandat', Json.stringOrNull(mandate, 'reference'))
          : null,
      preview: Json.string(json, 'preview'),
      lastMessageAt: Json.date(json, 'last_message_at'),
      lastAuthor: switch (Json.string(json, 'last_author_side')) {
        'staff' => MessageSide.team,
        'tenant' || 'owner' => MessageSide.counterpart,
        final other => throw FormatException(
          '« last_author_side » inconnu : $other',
        ),
      },
      unread: Json.boolean(json, 'unread'),
      awaitingReply: Json.boolean(json, 'awaiting_reply'),
      messageCount: Json.integer(json, 'message_count'),
      hasAttachments: Json.boolean(json, 'has_attachments'),
      counterpartReadAt: Json.dateOrNull(json, 'counterpart_last_read_at'),
      mutedUntil: Json.dateOrNull(json, 'muted_until'),
      canReply: true,
    );
  }

  static String? _reference(String label, String? reference) =>
      reference == null ? null : '$label $reference';

  bool get isClosed => status == ThreadStatus.closed;

  ThreadSummary copyWith({
    ThreadStatus? status,
    bool? unread,
    bool? canReply,
    DateTime? counterpartReadAt,
    DateTime? lastMessageAt,
    String? preview,
    MessageSide? lastAuthor,
    int? messageCount,
  }) => ThreadSummary(
    id: id,
    subject: subject,
    status: status ?? this.status,
    counterpartName: counterpartName,
    reference: reference,
    preview: preview ?? this.preview,
    lastMessageAt: lastMessageAt ?? this.lastMessageAt,
    lastAuthor: lastAuthor ?? this.lastAuthor,
    unread: unread ?? this.unread,
    awaitingReply: awaitingReply,
    messageCount: messageCount ?? this.messageCount,
    hasAttachments: hasAttachments,
    counterpartReadAt: counterpartReadAt ?? this.counterpartReadAt,
    mutedUntil: mutedUntil,
    canReply: canReply ?? this.canReply,
  );
}

/// Une page de messages : les plus récents (`nextCursor` remonte l'historique)
/// ou ceux qui suivent un message connu (interrogation périodique).
class const MessagesPage({
  required final List<ThreadMessage> items,
  required final bool hasMore,
  required final String? nextCursor,
  required final ThreadStatus status,
  required final DateTime? counterpartReadAt,
  required final bool? canReply,
}) {}

class const ThreadDetail({
  required final ThreadSummary summary,
  required final List<ThreadMessage> messages,
  required final String? earlierCursor,
}) {
  bool get hasEarlier => earlierCursor != null;

  ThreadMessage? get latest => messages.isEmpty ? null : messages.last;

  ThreadDetail copyWith({
    ThreadSummary? summary,
    List<ThreadMessage>? messages,
    String? earlierCursor,
    bool clearEarlier = false,
  }) => ThreadDetail(
    summary: summary ?? this.summary,
    messages: messages ?? this.messages,
    earlierCursor: clearEarlier ? null : earlierCursor ?? this.earlierCursor,
  );
}
