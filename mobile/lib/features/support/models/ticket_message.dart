import '../../../core/utils/json_reader.dart';

class const TicketAttachment({
  required final String id,
  required final String name,
  required final String mimeType,
  required final int sizeBytes,
}) {
  factory TicketAttachment.fromJson(Map<String, Object?> json) =>
      TicketAttachment(
        id: Json.string(json, 'id'),
        name: Json.string(json, 'name'),
        mimeType: Json.string(json, 'mime_type'),
        sizeBytes: Json.integer(json, 'size_bytes'),
      );
}

/// `SupportMessageResource` vue du demandeur : l'identité d'un opérateur n'en
/// sort jamais (« Support eGuardImmo »), les notes internes sont absentes.
class const TicketMessage({
  required final String id,
  required final String authorName,
  required final bool fromSupport,
  required final String body,
  required final DateTime sentAt,
  required final List<TicketAttachment> attachments,
}) {
  factory TicketMessage.fromJson(Map<String, Object?> json) {
    final author = Json.child(json, 'author');
    return TicketMessage(
      id: Json.string(json, 'id'),
      authorName: Json.string(author, 'name'),
      fromSupport: Json.boolean(author, 'support'),
      body: Json.string(json, 'body'),
      sentAt: Json.date(json, 'sent_at'),
      attachments: [
        for (final entry in Json.list(json['attachments'], 'attachments'))
          TicketAttachment.fromJson(Json.object(entry, 'attachments')),
      ],
    );
  }
}
