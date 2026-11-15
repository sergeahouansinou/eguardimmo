<?php

declare(strict_types=1);

namespace App\Modules\Parties\Actions;

use App\Modules\Catalog\Enums\CustomFieldEntity;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\CustomFieldValidator;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Parties\Data\PartyChangesData;
use App\Modules\Parties\Enums\ErrorCode;
use App\Modules\Parties\Models\Party;
use App\Modules\Parties\Support\PartyGuard;
use App\Modules\Parties\Support\PartyShape;
use Illuminate\Support\Facades\DB;

final readonly class UpdateParty
{
    private const IDENTITE = ['last_name', 'first_name', 'company_name', 'legal_form_term_id', 'birth_date'];

    public function __construct(
        private TermDirectory $termes,
        private CustomFieldValidator $champs,
        private SyncPartyCategories $categories,
        private SyncPartyTags $etiquettes,
    ) {}

    public function handle(Party $party, PartyChangesData $changements): Party
    {
        return DB::transaction(function () use ($party, $changements): Party {
            $partie = Party::query()->whereKey($party->id)->lockForUpdate()->firstOrFail();

            PartyGuard::editable($partie);

            if ($partie->lock_version !== $changements->lockVersion) {
                throw ErrorCode::VersionConflict->problem();
            }

            $identite = array_merge(
                array_intersect_key($partie->getAttributes(), array_flip(self::IDENTITE)),
                array_intersect_key($changements->fields, array_flip(self::IDENTITE)),
            );
            $identite['birth_date'] = $this->date($identite['birth_date'] ?? null);

            PartyShape::assert($partie->kind, $identite);

            $legalForm = $identite['legal_form_term_id'] ?? null;

            if (is_string($legalForm) && $legalForm !== $partie->legal_form_term_id) {
                $this->termes->findAssignable($legalForm, VocabularyKey::LegalForm);
            }

            $personnalises = $changements->customFields === null
                ? $partie->custom_fields
                : $this->champs->validate(CustomFieldEntity::Party, $changements->customFields, $partie->custom_fields);

            $partie->fill([
                ...$identite,
                'display_name' => PartyShape::displayName($partie->kind, $identite),
                'custom_fields' => $personnalises,
                'lock_version' => $partie->lock_version + 1,
            ]);

            foreach (['address', 'language'] as $champ) {
                if (array_key_exists($champ, $changements->fields)) {
                    $partie->setAttribute($champ, $changements->fields[$champ] === [] ? null : $changements->fields[$champ]);
                }
            }

            $partie->save();

            if ($changements->customFields !== null) {
                $this->champs->recordUsage(CustomFieldEntity::Party, $personnalises);
            }

            if ($changements->categoryIds !== null) {
                $this->categories->handle($partie, $changements->categoryIds);
            }

            if ($changements->tagIds !== null) {
                $this->etiquettes->handle($partie, $changements->tagIds);
            }

            return $partie;
        });
    }

    private function date(mixed $valeur): ?string
    {
        return $valeur === null ? null : substr((string) $valeur, 0, 10);
    }
}
