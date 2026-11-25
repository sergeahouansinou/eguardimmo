import 'listing_enums.dart';
import 'place.dart';

class const ListingFilters({
  final Place? place,
  final ListingCategory? category,
}) {
  static const empty = ListingFilters();

  ListingFilters withPlace(Place? value) =>
      ListingFilters(place: value, category: category);

  ListingFilters withCategory(ListingCategory? value) =>
      ListingFilters(place: place, category: value);

  Map<String, Object?> toQuery() => {
    'kind': ListingKind.shortStay.wire,
    'place': ?place?.slug,
    'category': ?category?.wire,
  };
}
