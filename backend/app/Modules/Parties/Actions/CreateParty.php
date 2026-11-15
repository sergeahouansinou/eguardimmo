<?php

declare(strict_types=1);

namespace App\Modules\Parties\Actions;

use App\Modules\Catalog\Enums\CustomFieldEntity;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\CustomFieldValidator;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Parties\Data\NewPartyData;
use App\Modules\Parties\Models\Party;
use App\Modules\Parties\Support\PartyShape;
use Illuminate\Support\Facades\DB;

final readonly class CreateParty
{
    public function __construct(
        private TermDirectory $termes,
        private CustomFieldValidator $champs,
        private SyncPartyCategories $categories,
        private SyncPartyTags $etiquettes,
    ) {}

    public function handle(NewPartyData $donnees): Party
    {
        $identite = [
            'last_name' => $donnees->lastName,
            'first_name' => $donnees->firstName,
            'company_name' => $donnees->companyName,
            'legal_form_term_id' => $donnees->legalFormTermId,
            'birth_date' => $donnees->birthDate,
        ];

        PartyShape::assert($donnees->kind, $identite);

        return DB::transaction(function () use ($donnees, $identite): Party {
            if ($donnees->legalFormTermId !== null) {
                $this->termes->findAssignable($donnees->legalFormTermId, VocabularyKey::LegalForm);
            }

            $personnalises = $this->champs->validate(CustomFieldEntity::Party, $donnees->customFields);

            $partie = Party::query()->create([
                ...$identite,
                'kind' => $donnees->kind,
                'display_name' => PartyShape::displayName($donnees->kind, $identite),
                'address' => $donnees->address,
                'language' => $donnees->language,
                'custom_fields' => $personnalises,
                'lock_version' => 1,
            ]);

            $this->champs->recordUsage(CustomFieldEntity::Party, $personnalises);
            $this->categories->handle($partie, $donnees->categoryIds);
            $this->etiquettes->handle($partie, $donnees->tagIds);

            return $partie;
        });
    }
}
