<?php

declare(strict_types=1);

namespace App\Modules\Listings\Http\Requests;

use App\Modules\Listings\Data\ListingFilters;
use App\Modules\Listings\Enums\Amenity;
use App\Modules\Listings\Enums\ListingCategory;
use App\Modules\Listings\Enums\ListingKind;
use App\Modules\Listings\Enums\ListingSort;
use App\Modules\Listings\Queries\PublicListings;
use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class SearchListingsRequest extends FormRequest
{
    use PaginatesWithCursor;

    private const int RECHERCHE_PAR_PAGE_MAX = 24;

    private const int RECHERCHE_PAR_PAGE = 12;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * Le curseur se nomme `after` ; ses colonnes dépendent du tri, un curseur d'un autre tri est refusé.
     *
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        $tri = ListingSort::tryFrom((string) $this->input('sort')) ?? ListingSort::Relevance;
        $curseur = $this->paginationRules(PublicListings::cursorColumns($tri))['cursor'];

        return [
            'per_page' => ['nullable', 'integer', 'min:1', 'max:'.self::RECHERCHE_PAR_PAGE_MAX],
            'after' => $curseur,
            'place' => ['nullable', 'string', 'max:140', 'regex:/^[a-z0-9-]+$/'],
            'kind' => ['nullable', Rule::enum(ListingKind::class)],
            'category' => ['nullable', Rule::enum(ListingCategory::class)],
            'guests' => ['nullable', 'integer', 'min:1', 'max:50'],
            'min_price' => ['nullable', 'integer', 'min:0', 'max:100000000'],
            'max_price' => ['nullable', 'integer', 'min:0', 'max:100000000', ...($this->filled('min_price') ? ['gte:min_price'] : [])],
            'amenities' => ['nullable', 'array', 'max:'.count(Amenity::cases())],
            'amenities.*' => ['string', Rule::enum(Amenity::class)],
            'sort' => ['nullable', Rule::enum(ListingSort::class)],
        ];
    }

    public function filters(): ListingFilters
    {
        /** @var list<string> $equipements */
        $equipements = array_values(array_unique((array) $this->validated('amenities', [])));

        return new ListingFilters(
            place: $this->filled('place') ? (string) $this->validated('place') : null,
            kind: $this->filled('kind') ? ListingKind::from((string) $this->validated('kind')) : null,
            category: $this->filled('category') ? ListingCategory::from((string) $this->validated('category')) : null,
            guests: $this->filled('guests') ? (int) $this->validated('guests') : null,
            minPrice: $this->filled('min_price') ? (int) $this->validated('min_price') : null,
            maxPrice: $this->filled('max_price') ? (int) $this->validated('max_price') : null,
            amenities: $equipements,
            sort: ListingSort::tryFrom((string) $this->validated('sort')) ?? ListingSort::Relevance,
            perPage: $this->filled('per_page') ? (int) $this->validated('per_page') : self::RECHERCHE_PAR_PAGE,
            after: $this->filled('after') ? (string) $this->validated('after') : null,
        );
    }
}
