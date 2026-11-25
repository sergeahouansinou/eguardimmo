import 'package:provider/provider.dart';
import 'package:provider/single_child_widget.dart';

import '../../core/services/api_client.dart';
import '../auth/viewmodels/session_viewmodel.dart';
import 'services/owner_service.dart';
import 'viewmodels/owner_access_viewmodel.dart';

List<SingleChildWidget> ownerProviders() => [
  ProxyProvider<ApiClient, OwnerService>(
    update: (_, api, _) => OwnerService(api),
  ),
  ChangeNotifierProxyProvider2<
    OwnerService,
    SessionViewModel,
    OwnerAccessViewModel
  >(
    create: (context) => OwnerAccessViewModel(
      context.read<OwnerService>(),
      userId: context.read<SessionViewModel>().user?.id,
    ),
    update: (_, service, session, previous) =>
        previous != null && previous.userId == session.user?.id
        ? previous
        : OwnerAccessViewModel(service, userId: session.user?.id),
  ),
];
