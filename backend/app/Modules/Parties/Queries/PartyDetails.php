<?php

declare(strict_types=1);

namespace App\Modules\Parties\Queries;

use App\Modules\Catalog\Data\TermData;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\Tagger;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Parties\Models\Party;
use App\Modules\Parties\Models\PartyContactCategory;
use App\Modules\Parties\Support\PartyDetail;

final readonly class PartyDetails
{
    public function __construct(
        private Parties $parties,
        private TermDirectory $termes,
        private Tagger $etiqueteuse,
    ) {}

    public function get(string $id): PartyDetail
    {
        return $this->of($this->parties->get($id));
    }

    public function of(Party $party): PartyDetail
    {
        $party = Party::query()
            ->with([
                'contactPoints' => fn ($q) => $q->orderByDesc('is_primary')->orderBy('type')->orderBy('created_at')->orderBy('id'),
                'identifiers' => fn ($q) => $q->orderBy('scheme')->orderBy('id'),
                'bankAccounts' => fn ($q) => $q->orderByDesc('valid_from')->orderByDesc('created_at')->orderByDesc('id'),
                'categories',
            ])
            ->findOrFail($party->id);

        $categories = $party->categories
            ->map(fn (PartyContactCategory $ligne): TermData => $this->termes->find($ligne->contact_category_term_id, VocabularyKey::ContactCategory))
            ->sortBy(fn (TermData $terme): array => [$terme->position, $terme->key])
            ->all();

        return new PartyDetail($party, array_values($categories), $this->etiqueteuse->tagsOf($party->getMorphClass(), $party->id));
    }
}
