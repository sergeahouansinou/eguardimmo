import '../../../core/state/async_view_model.dart';
import '../models/listing.dart';
import '../services/marketplace_service.dart';

class ListingDetailViewModel(
  final MarketplaceService _service,
  final String ref, {
  super.logger,
}) extends AsyncViewModel<ListingDetail> {
  @override
  Future<ListingDetail> fetch() => _service.listing(ref);
}
