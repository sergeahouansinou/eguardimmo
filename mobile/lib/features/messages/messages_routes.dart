import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/routes/app_routes.dart';
import '../../core/widgets/state_message.dart';
import '../auth/viewmodels/session_viewmodel.dart';
import '../auth/widgets/session_gate.dart';
import '../profiles/models/profile_space.dart';
import '../profiles/viewmodels/profiles_viewmodel.dart';
import 'models/messaging_scope.dart';
import 'screens/messages_screen.dart';
import 'screens/new_thread_screen.dart';
import 'screens/thread_screen.dart';
import 'services/threads_service.dart';
import 'viewmodels/new_thread_viewmodel.dart';
import 'viewmodels/thread_viewmodel.dart';

List<RouteBase> messagesTabRoutes() => [
  GoRoute(path: AppRoutes.messages, builder: (_, _) => const MessagesScreen()),
];

List<RouteBase> messagesRootRoutes() => [
  GoRoute(
    path: AppRoutes.newConversation,
    builder: (context, _) => _scoped(
      context,
      (scope) => scope.canOpenThread,
      (scope) => ChangeNotifierProvider(
        create: (context) => NewThreadViewModel(
          context.read<ThreadsService>(),
          ThreadsEndpoint(scope),
        )..load(),
        child: const NewThreadScreen(),
      ),
    ),
  ),
  GoRoute(
    path: AppRoutes.conversationPattern,
    builder: (context, state) {
      final id = state.pathParameters['id']!;
      return _scoped(
        context,
        (_) => true,
        (scope) => ChangeNotifierProvider(
          key: ValueKey('${scope.key}|$id'),
          create: (context) => ThreadViewModel(
            context.read<ThreadsService>(),
            ThreadsEndpoint(scope),
            id,
          )..load(),
          child: const ThreadScreen(),
        ),
      );
    },
  ),
];

/// Les écrans de fil dépendent du profil actif : sans conversation pour ce
/// profil, l'écran le dit au lieu de réclamer une API qui n'existe pas.
Widget _scoped(
  BuildContext context,
  bool Function(MessagingScope scope) allowed,
  Widget Function(MessagingScope scope) build,
) {
  final profiles = context.watch<ProfilesViewModel>();
  final signedIn = context.watch<SessionViewModel>().isSignedIn;
  final scope = MessagingScope.of(ProfileSpace.of(profiles.active));
  if (signedIn && scope != null && allowed(scope)) return build(scope);
  return Scaffold(
    appBar: AppBar(),
    body: SafeArea(
      child: SessionGate(
        signedOutMessage: 'Connectez-vous pour consulter vos messages.',
        builder: (context, _) => StateMessage(
          icon: Icons.chat_bubble_outline_rounded,
          title: 'Conversation indisponible',
          message: 'Ce profil n’a pas accès à cette conversation. Changez de profil depuis l’onglet Messages.',
          actionLabel: 'Retour aux messages',
          onAction: () => context.go(AppRoutes.messages),
        ),
      ),
    ),
  );
}
