<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Actions;

use App\Modules\Catalog\Data\TermData;
use App\Modules\Catalog\Enums\ErrorCode;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\Models\Term;
use App\Modules\Catalog\Queries\VisibleTerms;
use App\Modules\Catalog\Support\TermMetadata;
use Illuminate\Support\Facades\DB;

final readonly class UpdateTerm
{
    public function __construct(private VisibleTerms $valeurs) {}

    /**
     * La clé, le sens système et le référentiel ne changent jamais. Un argument nul laisse la valeur inchangée.
     *
     * @param  array<string, string>|null  $labels
     * @param  array<string, mixed>|null  $metadata
     */
    public function handle(Term $valeur, ?array $labels, ?array $metadata): TermData
    {
        if ($valeur->isPlatform()) {
            throw ErrorCode::PlatformTermImmutable->problem();
        }

        $metadata = $metadata === null ? null : TermMetadata::validated(VocabularyKey::from($valeur->vocabulary), $metadata);

        return DB::transaction(function () use ($valeur, $labels, $metadata): TermData {
            if ($labels !== null) {
                $valeur->labels = $labels;
            }

            if ($metadata !== null) {
                $valeur->metadata = $metadata === [] ? null : $metadata;
            }

            $valeur->save();

            return $this->valeurs->one($valeur);
        });
    }
}
