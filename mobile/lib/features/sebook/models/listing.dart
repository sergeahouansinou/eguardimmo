import '../../../core/utils/json_reader.dart';
import 'listing_enums.dart';
import 'money.dart';

class const ListingCity({
  required final String slug,
  required final String name,
  final String? postalCode,
}) {
  factory ListingCity.fromJson(Map<String, Object?> json) => ListingCity(
    slug: Json.string(json, 'slug'),
    name: Json.string(json, 'name'),
    postalCode: Json.stringOrNull(json, 'postal_code'),
  );
}

/// Carte d'annonce (`ListingCardResource`) : ville, quartier et hôte peuvent
/// être absents.
class const ListingSummary({
  required final String ref,
  required final ListingKind kind,
  required final ListingCategory category,
  required final String title,
  required final ListingCity? city,
  required final String? neighbourhood,
  required final Money price,
  required final PriceUnit priceUnit,
  required final int capacity,
  required final int? areaM2,
  required final int? rooms,
  required final List<String> amenities,
  required final int? minNights,
  required final String? hostName,
}) {
  factory ListingSummary.fromJson(Map<String, Object?> json) {
    final city = Json.childOrNull(json, 'city');
    return ListingSummary(
      ref: Json.string(json, 'ref'),
      kind: ListingKind.parse(Json.string(json, 'kind')),
      category: ListingCategory.parse(Json.string(json, 'category')),
      title: Json.string(json, 'title'),
      city: city == null ? null : ListingCity.fromJson(city),
      neighbourhood: Json.stringOrNull(json, 'neighbourhood'),
      price: Money.fromJson(json, 'price'),
      priceUnit: PriceUnit.parse(Json.string(json, 'price_unit')),
      capacity: Json.integer(json, 'capacity'),
      areaM2: Json.integerOrNull(json, 'area_m2'),
      rooms: Json.integerOrNull(json, 'rooms'),
      amenities: Json.strings(json, 'amenities'),
      minNights: Json.integerOrNull(json, 'min_nights'),
      hostName: Json.stringOrNull(Json.child(json, 'host'), 'name'),
    );
  }

  String? get place {
    final parts = [?city?.name, ?neighbourhood];
    return parts.isEmpty ? null : parts.join(' · ');
  }
}

/// Annonce complète (`PublicListingResource`).
class const ListingDetail({
  required final ListingSummary summary,
  required final String description,
  required final Money? deposit,
  required final CancellationPolicy cancellationPolicy,
}) {
  factory ListingDetail.fromJson(Map<String, Object?> json) => ListingDetail(
    summary: ListingSummary.fromJson(json),
    description: Json.string(json, 'description'),
    deposit: Money.fromJsonOrNull(json, 'deposit'),
    cancellationPolicy: CancellationPolicy.parse(
      Json.string(json, 'cancellation_policy'),
    ),
  );

  int get minNights => summary.minNights ?? 1;
}

/// Page de résultats : `meta.next_cursor` est null en fin de liste.
class const ListingPage({
  required final List<ListingSummary> items,
  required final String? nextCursor,
  final String? moreFailure,
  final bool loadingMore = false,
}) {
  factory ListingPage.fromBody(Object? body) {
    final root = Json.object(body, '/marketplace/listings');
    final items = [
      for (final entry in Json.dataList(root, '/marketplace/listings'))
        ListingSummary.fromJson(Json.object(entry, 'annonce')),
    ];
    final meta = Json.child(root, 'meta');
    return ListingPage(
      items: items,
      nextCursor: Json.stringOrNull(meta, 'next_cursor'),
    );
  }

  bool get hasMore => nextCursor != null;

  ListingPage copyWith({
    List<ListingSummary>? items,
    String? nextCursor,
    bool clearCursor = false,
    String? moreFailure,
    bool clearFailure = false,
    bool? loadingMore,
  }) => ListingPage(
    items: items ?? this.items,
    nextCursor: clearCursor ? null : (nextCursor ?? this.nextCursor),
    moreFailure: clearFailure ? null : (moreFailure ?? this.moreFailure),
    loadingMore: loadingMore ?? this.loadingMore,
  );
}
