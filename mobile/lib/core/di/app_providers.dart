import 'package:provider/provider.dart';
import 'package:provider/single_child_widget.dart';

import '../../features/agency/agency_providers.dart';
import '../../features/auth/auth_providers.dart';
import '../../features/messages/messages_providers.dart';
import '../../features/owner/owner_providers.dart';
import '../../features/profiles/profiles_providers.dart';
import '../../features/sebook/sebook_providers.dart';
import '../../features/support/support_providers.dart';
import '../../features/tenant/tenant_providers.dart';
import '../services/api_client.dart';
import '../services/token_storage.dart';

/// Assemble les providers : chaque feature expose sa propre liste, app.dart
/// ne grossit pas avec le nombre de features.
List<SingleChildWidget> buildProviders({
  required ApiClient api,
  required TokenStorage tokenStorage,
}) => [
  Provider<ApiClient>.value(value: api),
  Provider<TokenStorage>.value(value: tokenStorage),
  ...authProviders(),
  ...profilesProviders(),
  ...sebookProviders(),
  ...messagesProviders(),
  ...supportProviders(),
  ...tenantProviders(),
  ...ownerProviders(),
  ...agencyProviders(),
];
