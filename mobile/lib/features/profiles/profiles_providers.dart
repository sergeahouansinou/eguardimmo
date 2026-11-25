import 'package:provider/provider.dart';
import 'package:provider/single_child_widget.dart';

import '../../core/services/api_client.dart';
import '../auth/viewmodels/session_viewmodel.dart';
import 'services/profiles_service.dart';
import 'viewmodels/profiles_viewmodel.dart';

List<SingleChildWidget> profilesProviders() => [
  ProxyProvider<ApiClient, ProfilesService>(
    update: (_, api, _) => ProfilesService(api),
  ),
  ChangeNotifierProxyProvider2<
    ProfilesService,
    SessionViewModel,
    ProfilesViewModel
  >(
    create: (context) => ProfilesViewModel(context.read<ProfilesService>()),
    update: (_, _, session, viewModel) => viewModel!..bind(session.user?.id),
  ),
];
