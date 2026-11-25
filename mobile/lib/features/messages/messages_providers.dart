import 'package:provider/provider.dart';
import 'package:provider/single_child_widget.dart';

import '../../core/services/api_client.dart';
import '../auth/viewmodels/session_viewmodel.dart';
import '../profiles/models/profile_space.dart';
import '../profiles/viewmodels/profiles_viewmodel.dart';
import 'models/messaging_scope.dart';
import 'services/threads_service.dart';
import 'viewmodels/thread_list_viewmodel.dart';

List<SingleChildWidget> messagesProviders() => [
  ProxyProvider<ApiClient, ThreadsService>(
    update: (_, api, _) => ThreadsService(api),
  ),
  ChangeNotifierProxyProvider3<
    ThreadsService,
    SessionViewModel,
    ProfilesViewModel,
    ThreadListViewModel
  >(
    create: (context) => ThreadListViewModel(context.read<ThreadsService>()),
    update: (_, _, session, profiles, viewModel) {
      final userId = session.user?.id;
      final scope = userId == null
          ? null
          : MessagingScope.of(ProfileSpace.of(profiles.active));
      return viewModel!
        ..useScope(scope)
        ..bind(scope == null ? null : '$userId|${scope.key}');
    },
  ),
];
