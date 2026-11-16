<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Actions;

use App\Modules\Catalog\Data\TermData;
use App\Modules\Catalog\Enums\ErrorCode;
use App\Modules\Catalog\Models\Term;
use App\Modules\Catalog\Models\TermOverride;
use App\Modules\Catalog\Queries\VisibleTerms;
use App\Modules\Catalog\Support\ConcurrentWrite;
use Illuminate\Support\Facades\DB;

final readonly class OverrideTerm
{
    public function __construct(private VisibleTerms $valeurs) {}

    /**
     * Remplace la surcharge de l'organisation ; une surcharge vide est supprimée.
     *
     * @param  array<string, string>|null  $labels
     */
    public function handle(Term $valeur, ?array $labels, bool $hidden, ?int $position): TermData
    {
        if (! $valeur->isPlatform()) {
            throw ErrorCode::TermNotPlatform->problem();
        }

        return ConcurrentWrite::replayOnce(fn (): TermData => DB::transaction(function () use ($valeur, $labels, $hidden, $position): TermData {
            $existante = TermOverride::query()->where('term_id', $valeur->id)->first();

            if ($labels === null && ! $hidden && $position === null) {
                $existante?->delete();

                return $this->valeurs->one($valeur);
            }

            TermOverride::query()->updateOrCreate(
                ['term_id' => $valeur->id],
                ['labels' => $labels, 'hidden' => $hidden, 'position' => $position],
            );

            return $this->valeurs->one($valeur);
        }));
    }
}
