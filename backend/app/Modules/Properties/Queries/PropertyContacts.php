<?php

declare(strict_types=1);

namespace App\Modules\Properties\Queries;

use App\Modules\Catalog\Data\TermData;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Modules\Properties\Data\PropertyContactData;
use App\Modules\Properties\Data\PropertyContactPageData;
use App\Modules\Properties\Enums\ErrorCode;
use App\Modules\Properties\Models\Property;
use App\Modules\Properties\Models\PropertyContact;
use App\Modules\Properties\Models\Unit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;

final readonly class PropertyContacts
{
    public function __construct(
        private PartyDirectory $parties,
        private TermDirectory $termes,
    ) {}

    public function ofProperty(string $propertyId, ?string $unitId, int $parPage): PropertyContactPageData
    {
        return $this->page(
            PropertyContact::query()->where('property_id', $propertyId)->when($unitId !== null, fn (Builder $q) => $q->where('unit_id', $unitId)),
            $parPage,
            false,
        );
    }

    public function ofParty(string $partyId, int $parPage): PropertyContactPageData
    {
        return $this->page(PropertyContact::query()->where('party_id', $partyId), $parPage, true);
    }

    public function one(PropertyContact $lien): PropertyContactData
    {
        $partie = $this->parties->find($lien->party_id);

        return $this->data(
            $lien,
            $partie->displayName,
            $partie->kind->value,
            $partie->isAnonymized,
            $lien->contact_category_term_id === null ? null : $this->termes->find($lien->contact_category_term_id, VocabularyKey::ContactCategory),
            null,
            $this->unitReferences([$lien])[$lien->unit_id] ?? null,
        );
    }

    public function get(string $propertyId, string $linkId): PropertyContact
    {
        return (Str::isUuid($linkId) ? PropertyContact::query()->where('property_id', $propertyId)->find($linkId) : null)
            ?? throw ErrorCode::PropertyContactNotFound->problem();
    }

    /**
     * @param  Builder<PropertyContact>  $requete
     */
    private function page(Builder $requete, int $parPage, bool $avecSite): PropertyContactPageData
    {
        $page = $requete->orderBy('id')->cursorPaginate($parPage);
        /** @var list<PropertyContact> $liens */
        $liens = array_values($page->items());

        $parties = $this->parties->findMany(array_values(array_unique(array_map(fn (PropertyContact $l): string => $l->party_id, $liens))));
        $categories = $this->termes->findMany(
            array_values(array_unique(array_filter(array_map(fn (PropertyContact $l): ?string => $l->contact_category_term_id, $liens)))),
            VocabularyKey::ContactCategory,
        );
        $sites = $avecSite
            ? Property::query()->whereIn('id', array_unique(array_map(fn (PropertyContact $l): string => $l->property_id, $liens)))->pluck('name', 'id')->all()
            : [];

        $references = $this->unitReferences($liens);

        $vues = array_map(fn (PropertyContact $l): PropertyContactData => $this->data(
            $l,
            $parties[$l->party_id]->displayName,
            $parties[$l->party_id]->kind->value,
            $parties[$l->party_id]->isAnonymized,
            $l->contact_category_term_id === null ? null : $categories[$l->contact_category_term_id],
            $avecSite ? (string) ($sites[$l->property_id] ?? '') : null,
            $references[$l->unit_id] ?? null,
        ), $liens);

        return new PropertyContactPageData($vues, $page->hasMorePages(), $page->nextCursor()?->encode());
    }

    /**
     * @param  list<PropertyContact>  $liens
     * @return array<string, string>
     */
    private function unitReferences(array $liens): array
    {
        $ids = array_values(array_unique(array_filter(array_map(fn (PropertyContact $l): ?string => $l->unit_id, $liens))));

        return $ids === [] ? [] : Unit::query()->whereIn('id', $ids)->pluck('reference', 'id')->all();
    }

    private function data(PropertyContact $lien, string $nom, string $genre, bool $anonymise, ?TermData $categorie, ?string $site, ?string $reference = null): PropertyContactData
    {
        return new PropertyContactData(
            $lien->id, $lien->property_id, $lien->unit_id, $lien->party_id, $nom, $genre, $anonymise, $categorie, $lien->created_at, $site, $reference,
        );
    }
}
