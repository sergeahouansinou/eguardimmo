import 'package:provider/provider.dart';
import 'package:provider/single_child_widget.dart';

import '../../core/services/api_client.dart';
import 'services/support_service.dart';

List<SingleChildWidget> supportProviders() => [
  ProxyProvider<ApiClient, SupportService>(
    update: (_, api, _) => SupportService(api),
  ),
];
