<?php

declare(strict_types=1);

namespace App\Modules\Parties\Actions;

use App\Modules\Catalog\Enums\CustomFieldEntity;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\CustomFieldValidator;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Parties\Data\NewPartyData;
use App\Modules\Parties\Data\PartyDuplicateData;
use App\Modules\Parties\Enums\ErrorCode;
use App\Modules\Parties\Models\Party;
use App\Modules\Parties\Queries\PartyDuplicates;
use App\Modules\Parties\Support\Fingerprinter;
use App\Modules\Parties\Support\PartyMatchKeys;
use App\Modules\Parties\Support\PartyShape;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final readonly class CreateParty
{
    public function __construct(
        private TermDirectory $termes,
        private CustomFieldValidator $champs,
        private SyncPartyCategories $categories,
        private SyncPartyTags $etiquettes,
        private AddContactPoint $ajoutCoordonnee,
        private AddIdentifier $ajoutIdentifiant,
        private PartyDuplicates $doublons,
        private Fingerprinter $empreintes,
        private OrganizationDirectory $organisation,
        private RecordAudit $audit,
    ) {}

    /**
     * Un doublon possible refuse la création (409) tant que le client n'a pas confirmé avec `allowDuplicate` ; la confirmation est auditée.
     */
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
        $cles = $this->cles($donnees);

        return DB::transaction(function () use ($donnees, $identite, $cles): Party {
            $candidats = $this->doublons->search($cles->kind, $cles->displayName, $cles->emails, $cles->phones, $cles->identifierHashes);

            if ($candidats !== [] && ! $donnees->allowDuplicate) {
                throw ErrorCode::PartyPossibleDuplicate->problem([
                    'candidates' => array_map(fn (PartyDuplicateData $c): array => $c->toArray(), $candidats),
                ]);
            }

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
                'note' => $donnees->note,
                'custom_fields' => $personnalises,
                'lock_version' => 1,
            ]);

            $this->champs->recordUsage(CustomFieldEntity::Party, $personnalises);
            $this->categories->handle($partie, $donnees->categoryIds);
            $this->etiquettes->handle($partie, $donnees->tagIds);

            foreach ($donnees->contactPoints as $point) {
                $this->ajoutCoordonnee->handle($partie, $point->type, $point->value, $point->label, $point->primary);
            }

            foreach ($donnees->identifiers as $identifiant) {
                $this->ajoutIdentifiant->handle($partie, $identifiant->scheme, $identifiant->country, $identifiant->value);
            }

            if ($candidats !== []) {
                $this->audit->handle('parties.duplicate.allowed', subject: $partie, metadata: [
                    'matches' => count($candidats),
                    'reasons' => implode(',', array_values(array_unique(array_merge(...array_map(fn (PartyDuplicateData $c): array => $c->reasons, $candidats))))),
                ]);
            }

            return $partie;
        });
    }

    private function cles(NewPartyData $donnees): PartyMatchKeys
    {
        try {
            return PartyMatchKeys::of($donnees, $this->empreintes, $this->organisation->country());
        } catch (ValidationException) {
            throw ValidationException::withMessages(['contact_points' => ['Une coordonnée est invalide (e-mail ou téléphone).']]);
        }
    }
}
