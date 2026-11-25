import '../../../core/utils/json_reader.dart';

enum MessageSide() {
  me,
  team,
  counterpart,
}

class const ThreadAttachment({
  required final String id,
  required final String name,
  required final String mimeType,
  required final int sizeBytes,
}) {
  factory ThreadAttachment.fromJson(Map<String, Object?> json) =>
      ThreadAttachment(
        id: Json.string(json, 'id'),
        name: Json.string(json, 'name'),
        mimeType: Json.string(json, 'mime_type'),
        sizeBytes: Json.integer(json, 'size_bytes'),
      );
}

class const ThreadMessage({
  required final String id,
  required final String? clientId,
  required final String authorName,
  required final MessageSide side,
  required final bool mine,
  required final String body,
  required final DateTime sentAt,
  required final bool redacted,
  required final List<ThreadAttachment> attachments,
}) {
  /// `CounterpartMessageResource` : `author.side` vaut `agency`, `me` ou
  /// `other` (un autre titulaire du même fil).
  factory ThreadMessage.fromCounterpart(Map<String, Object?> json) {
    final author = Json.child(json, 'author');
    return ThreadMessage(
      id: Json.string(json, 'id'),
      clientId: Json.stringOrNull(json, 'client_id'),
      authorName: Json.string(author, 'name'),
      side: switch (Json.string(author, 'side')) {
        'agency' => MessageSide.team,
        'me' => MessageSide.me,
        'other' => MessageSide.counterpart,
        final other => throw FormatException(
          '« author.side » inconnu : $other',
        ),
      },
      mine: Json.boolean(json, 'mine'),
      body: Json.string(json, 'body'),
      sentAt: Json.date(json, 'sent_at'),
      redacted: Json.boolean(json, 'redacted'),
      attachments: _attachments(json),
    );
  }

  /// `ExternalMessageResource` : `author.side` vaut `staff`, `tenant` ou
  /// `owner`.
  factory ThreadMessage.fromStaff(Map<String, Object?> json) {
    final author = Json.child(json, 'author');
    final mine = Json.boolean(json, 'mine');
    final side = switch (Json.string(author, 'side')) {
      'staff' => mine ? MessageSide.me : MessageSide.team,
      'tenant' || 'owner' => MessageSide.counterpart,
      final other => throw FormatException('« author.side » inconnu : $other'),
    };
    return ThreadMessage(
      id: Json.string(json, 'id'),
      clientId: Json.stringOrNull(json, 'client_id'),
      authorName: Json.string(author, 'name'),
      side: side,
      mine: mine,
      body: Json.string(json, 'body'),
      sentAt: Json.date(json, 'sent_at'),
      redacted: Json.boolean(json, 'redacted'),
      attachments: _attachments(json),
    );
  }

  static List<ThreadAttachment> _attachments(Map<String, Object?> json) => [
    for (final entry in Json.list(json['attachments'], 'attachments'))
      ThreadAttachment.fromJson(Json.object(entry, 'attachments')),
  ];
}
