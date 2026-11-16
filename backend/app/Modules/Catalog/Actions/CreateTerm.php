<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Actions;

use App\Modules\Catalog\Data\NewTermData;
use App\Modules\Catalog\Data\TermData;
use App\Modules\Catalog\Enums\ErrorCode;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\Models\Term;
use App\Modules\Catalog\Queries\VisibleTerms;
use App\Modules\Catalog\Support\TermMetadata;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final readonly class CreateTerm
{
    public function __construct(
        private VisibleTerms $valeurs,
        private CurrentOrganization $organisation,
    ) {}

    public function handle(VocabularyKey $vocabulaire, NewTermData $donnees): TermData
    {
        if (! $vocabulaire->extensible()) {
            throw ErrorCode::VocabularyClosed->problem();
        }

        $metadata = TermMetadata::validated($vocabulaire, $donnees->metadata);
        $this->verifierParent($vocabulaire, $donnees->parentId);

        try {
            return DB::transaction(function () use ($vocabulaire, $donnees, $metadata): TermData {
                $pris = $this->valeurs->query()->where('vocabulary', $vocabulaire->value)->where('key', $donnees->key)->exists();

                if ($pris) {
                    throw ErrorCode::TermKeyTaken->problem();
                }

                $derniere = $this->valeurs->query()->where('vocabulary', $vocabulaire->value)->max('position');

                $valeur = Term::query()->create([
                    'organization_id' => $this->organisation->id(),
                    'vocabulary' => $vocabulaire->value,
                    'key' => $donnees->key,
                    'labels' => $donnees->labels,
                    'semantic_key' => $donnees->semanticKey,
                    'parent_id' => $donnees->parentId,
                    'position' => is_numeric($derniere) ? (int) $derniere + 1 : 0,
                    'metadata' => $metadata === [] ? null : $metadata,
                    'is_system' => false,
                ]);

                return $this->valeurs->one($valeur);
            });
        } catch (UniqueConstraintViolationException) {
            throw ErrorCode::TermKeyTaken->problem();
        }
    }

    private function verifierParent(VocabularyKey $vocabulaire, ?string $parentId): void
    {
        if ($parentId === null) {
            return;
        }

        $parent = $vocabulaire->hierarchical() ? $this->valeurs->find($parentId, $vocabulaire) : null;

        if ($parent === null || $parent->archived_at !== null) {
            throw ValidationException::withMessages(['parent_id' => ['Ce référentiel n\'a pas de valeur parente correspondante.']]);
        }
    }
}
