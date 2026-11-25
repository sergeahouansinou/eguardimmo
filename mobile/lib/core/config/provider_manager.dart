import 'package:flutter/foundation.dart';
import 'package:provider/provider.dart';
import 'package:provider/single_child_widget.dart';

import '../../features/agency/services/agency_access_service.dart';
import '../../features/agency/services/agency_maintenance_service.dart';
import '../../features/agency/services/agency_service.dart';
import '../../features/auth/services/auth_service.dart';
import '../../features/auth/viewmodels/session_viewmodel.dart';
import '../../features/messages/models/messaging_scope.dart';
import '../../features/messages/services/threads_service.dart';
import '../../features/messages/viewmodels/thread_list_viewmodel.dart';
import '../../features/owner/services/owner_service.dart';
import '../../features/owner/viewmodels/owner_access_viewmodel.dart';
import '../../features/profiles/models/profile_space.dart';
import '../../features/profiles/services/profiles_service.dart';
import '../../features/profiles/viewmodels/profiles_viewmodel.dart';
import '../../features/sebook/services/bookings_service.dart';
import '../../features/sebook/services/marketplace_service.dart';
import '../../features/sebook/viewmodels/bookings_viewmodel.dart';
import '../../features/sebook/viewmodels/explore_viewmodel.dart';
import '../../features/sebook/viewmodels/favorites_viewmodel.dart';
import '../../features/sebook/viewmodels/place_search_viewmodel.dart';
import '../../features/support/services/support_service.dart';
import '../../features/tenant/services/tenant_leases_service.dart';
import '../../features/tenant/services/tenant_maintenance_service.dart';
import '../../features/tenant/services/tenant_rent_service.dart';
import '../security/pinned_transport.dart';
import '../services/api_client.dart';
import '../services/token_storage.dart';
import 'app_config.dart';

final List<SingleChildWidget> providers = [
  ...independentServices,
  ...dependentServices,
];

final List<SingleChildWidget> independentServices = [
  Provider<TokenStorage>(create: (_) => SecureTokenStorage()),
  Provider<ApiClient>(
    create: (context) => ApiClient(
      baseUrl: AppConfig.current.apiBaseUrl,
      tokenStorage: context.read<TokenStorage>(),
      requireHttps: AppConfig.current.requiresHttps(),
      dio: PinnedTransport.dio(AppConfig.current),
    ),
  ),
];

/// L'ordre compte : un provider ne peut lire que ceux déclarés avant lui.
final List<SingleChildWidget> dependentServices = [
  // Session
  ProxyProvider2<ApiClient, TokenStorage, AuthService>(
    update: (_, api, tokens, _) =>
        AuthService(api, tokens, deviceName: _deviceLabel()),
  ),
  ChangeNotifierProxyProvider<AuthService, SessionViewModel>(
    create: (context) {
      final session = SessionViewModel(context.read<AuthService>());
      context.read<ApiClient>().onSessionExpired = session.expire;
      return session..bootstrap();
    },
    update: (_, _, session) => session!,
  ),
  // Profils
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
  // Sebook
  ProxyProvider<ApiClient, MarketplaceService>(
    update: (_, api, _) => MarketplaceService(api),
  ),
  ProxyProvider<ApiClient, BookingsService>(
    update: (_, api, _) => BookingsService(api),
  ),
  ChangeNotifierProxyProvider<MarketplaceService, ExploreViewModel>(
    create: (context) =>
        ExploreViewModel(context.read<MarketplaceService>())..load(),
    update: (_, _, viewModel) => viewModel!,
  ),
  ChangeNotifierProxyProvider<MarketplaceService, PlaceSearchViewModel>(
    create: (context) =>
        PlaceSearchViewModel(context.read<MarketplaceService>()),
    update: (_, _, viewModel) => viewModel!,
  ),
  ChangeNotifierProxyProvider2<
    MarketplaceService,
    SessionViewModel,
    FavoritesViewModel
  >(
    create: (context) => FavoritesViewModel(context.read<MarketplaceService>()),
    update: (_, _, session, viewModel) => viewModel!..bind(session.user?.id),
  ),
  ChangeNotifierProxyProvider2<
    BookingsService,
    SessionViewModel,
    BookingsViewModel
  >(
    create: (context) => BookingsViewModel(context.read<BookingsService>()),
    update: (_, _, session, viewModel) => viewModel!..bind(session.user?.id),
  ),
  // Messagerie
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
  // Support
  ProxyProvider<ApiClient, SupportService>(
    update: (_, api, _) => SupportService(api),
  ),
  // Locataire
  ProxyProvider<ApiClient, TenantRentService>(
    update: (_, api, _) => TenantRentService(api),
  ),
  ProxyProvider<ApiClient, TenantLeasesService>(
    update: (_, api, _) => TenantLeasesService(api),
  ),
  ProxyProvider<ApiClient, TenantMaintenanceService>(
    update: (_, api, _) => TenantMaintenanceService(api),
  ),
  // Propriétaire
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
  // Agence
  ProxyProvider<ApiClient, AgencyService>(
    update: (_, api, _) => AgencyService(api),
  ),
  ProxyProvider<ApiClient, AgencyMaintenanceService>(
    update: (_, api, _) => AgencyMaintenanceService(api),
  ),
  ProxyProvider<ApiClient, AgencyAccessService>(
    update: (_, api, _) => AgencyAccessService(api),
  ),
];

String _deviceLabel() => switch (defaultTargetPlatform) {
  TargetPlatform.iOS => 'eGuardImmo iOS',
  TargetPlatform.android => 'eGuardImmo Android',
  _ => 'eGuardImmo mobile',
};
