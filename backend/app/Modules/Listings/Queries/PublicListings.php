<?php

declare(strict_types=1);

namespace App\Modules\Listings\Queries;

use App\Modules\Geography\PublicApi\CityDirectory;
use App\Modules\Listings\Data\ListingFilters;
use App\Modules\Listings\Data\ListingPageData;
use App\Modules\Listings\Data\ListingViewData;
use App\Modules\Listings\Enums\ErrorCode;
use App\Modules\Listings\Enums\ListingSort;
use App\Modules\Listings\Enums\ListingStatus;
use App\Modules\Listings\Models\Listing;
use App\Modules\Listings\Support\PublicRef;
use App\Shared\Tenancy\AcrossOrganizations;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\Cursor;

/**
 * Lectures publiques : annonces publiées seulement, toutes organisations confondues.
 */
final readonly class PublicListings
{
    public function __construct(
        private ListingViews $vues,
        private CityDirectory $villes,
    ) {}

    public function published(string $ref): Listing
    {
        return (PublicRef::isValid($ref) ? self::base()->where('public_ref', $ref)->first() : null) ?? throw ErrorCode::ListingNotFound->problem();
    }

    public function show(string $ref): ListingViewData
    {
        return $this->vues->one($this->published($ref), true);
    }

    public function search(ListingFilters $filtres): ListingPageData
    {
        $ville = $filtres->place === null ? null : $this->villes->findBySlug($filtres->place);

        if ($filtres->place !== null && $ville === null) {
            return new ListingPageData([], false, null);
        }

        $requete = self::base()
            ->when($ville !== null, fn (Builder $q) => $q->where('city_id', $ville?->id))
            ->when($filtres->kind !== null, fn (Builder $q) => $q->where('kind', $filtres->kind?->value))
            ->when($filtres->category !== null, fn (Builder $q) => $q->where('category', $filtres->category?->value))
            ->when($filtres->guests !== null, fn (Builder $q) => $q->where('capacity', '>=', $filtres->guests))
            ->when($filtres->minPrice !== null, fn (Builder $q) => $q->where('price_minor', '>=', $filtres->minPrice))
            ->when($filtres->maxPrice !== null, fn (Builder $q) => $q->where('price_minor', '<=', $filtres->maxPrice));

        foreach ($filtres->amenities as $equipement) {
            $requete->whereJsonContains('amenities', $equipement);
        }

        [$colonnes, $requete] = $this->tri($requete, $filtres->sort);
        $page = $requete->cursorPaginate($filtres->perPage, cursor: $filtres->after === null ? null : Cursor::fromEncoded($filtres->after));

        /** @var list<Listing> $annonces */
        $annonces = array_values($page->items());
        $suivant = $page->nextCursor();

        return new ListingPageData(
            $this->vues->many($annonces, true),
            $page->hasMorePages(),
            $suivant === null ? null : self::encode($suivant, $colonnes),
        );
    }

    /**
     * Les colonnes de tri du curseur voyagent en chaîne : c'est ce que la validation du curseur attend.
     *
     * @return array<string, string> colonne => règle de validation
     */
    public static function cursorColumns(ListingSort $tri): array
    {
        return match ($tri) {
            ListingSort::PriceAsc, ListingSort::PriceDesc => ['price_minor' => 'integer', 'id' => 'uuid'],
            ListingSort::Relevance, ListingSort::Recent => ['published_at' => 'date', 'id' => 'uuid'],
        };
    }

    /**
     * @return Builder<Listing>
     */
    private static function base(): Builder
    {
        return AcrossOrganizations::query(Listing::class)->where('status', ListingStatus::Published->value);
    }

    /**
     * @param  Builder<Listing>  $requete
     * @return array{list<string>, Builder<Listing>}
     */
    private function tri(Builder $requete, ListingSort $tri): array
    {
        $ordonnee = match ($tri) {
            ListingSort::PriceAsc => $requete->orderBy('price_minor')->orderBy('id'),
            ListingSort::PriceDesc => $requete->orderByDesc('price_minor')->orderByDesc('id'),
            ListingSort::Relevance, ListingSort::Recent => $requete->orderByDesc('published_at')->orderByDesc('id'),
        };

        return [array_keys(self::cursorColumns($tri)), $ordonnee];
    }

    /**
     * @param  list<string>  $colonnes
     */
    private static function encode(Cursor $curseur, array $colonnes): string
    {
        $parametres = [];

        foreach ($colonnes as $colonne) {
            $parametres[$colonne] = (string) $curseur->parameter($colonne);
        }

        return (new Cursor($parametres, $curseur->pointsToNextItems()))->encode();
    }
}
