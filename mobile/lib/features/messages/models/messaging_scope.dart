import '../../../core/utils/path_ids.dart';
import '../../profiles/models/profile_space.dart';

enum ThreadKind(final String wire, final String label) {
  tenant('tenant', 'Locataires'),
  owner('owner', 'Mandants'),
}

/// Ce que le profil actif peut faire avec les conversations. L'écriture du
/// mandant est refusée par le serveur à tout jeton personnel (ADR 0032, 5) :
/// l'application le dit au lieu de proposer une saisie vouée à l'échec.
class const MessagingScope({
  required final SpaceKind space,
  final String? organizationId,
  final List<ThreadKind> kinds = const [],
}) {
  /// Le voyageur n'a pas de conversation : seul le support lui est ouvert.
  static MessagingScope? of(ProfileSpace profile) => switch (profile.kind) {
    SpaceKind.marketplace => null,
    SpaceKind.tenant => const MessagingScope(space: SpaceKind.tenant),
    SpaceKind.owner => const MessagingScope(space: SpaceKind.owner),
    SpaceKind.organization => MessagingScope(
      space: SpaceKind.organization,
      organizationId: profile.organizationId,
      kinds: profile.agency
          ? const [ThreadKind.tenant, ThreadKind.owner]
          : const [ThreadKind.tenant],
    ),
  };

  bool get isStaff => space == SpaceKind.organization;
  bool get canWrite => space != SpaceKind.owner;
  bool get canMarkRead => space != SpaceKind.owner;
  bool get canOpenThread => space == SpaceKind.tenant;
  bool get canCloseThread => isStaff;

  String get key => '${space.apiSpace}:${organizationId ?? ''}';
}

/// Chemins d'API d'une boîte : celle du locataire, du mandant, ou d'une
/// organisation pour un type de fil.
class const ThreadsEndpoint(
  final MessagingScope scope, {
  final ThreadKind? kind,
}) {
  String get _base => switch (scope.space) {
    SpaceKind.tenant => '/tenant',
    SpaceKind.owner => '/owner',
    SpaceKind.organization =>
      '/org/${PathIds.segment(scope.organizationId ?? '')}',
    SpaceKind.marketplace => throw StateError('Pas de conversation voyageur'),
  };

  String get conversations => '$_base/conversations';
  String conversation(String id) => '$conversations/${PathIds.segment(id)}';
  String messages(String id) => '${conversation(id)}/messages';
  String attachment(String id) =>
      '$_base/conversation-attachments/${PathIds.segment(id)}';
  String get options => '$conversations/options';
}
