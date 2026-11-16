<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Actions;

use App\Modules\Catalog\Data\TermData;
use App\Modules\Catalog\Enums\ErrorCode;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\Models\TermOverride;
use App\Modules\Catalog\Queries\VisibleTerms;
use App\Modules\Catalog\Support\ConcurrentWrite;
use Illuminate\Support\Facades\DB;

final readonly class ReorderTerms
{
    public function __construct(private VisibleTerms $valeurs) {}

    /**
     * Les valeurs citées passent en tête dans l'ordre reçu, les autres suivent dans leur ordre actuel. Une valeur de
     * la plateforme se place par surcharge, une valeur de l'organisation directement ; seules les positions modifiées sont écrites.
     *
     * @param  list<string>  $ids
     * @return list<TermData>
     */
    public function handle(VocabularyKey $vocabulaire, array $ids): array
    {
        return ConcurrentWrite::replayOnce(fn (): array => DB::transaction(function () use ($vocabulaire, $ids): array {
            $courantes = [];

            foreach ($this->valeurs->resolved($vocabulaire, includeInactive: true) as $donnee) {
                $courantes[$donnee->id] = $donnee;
            }

            if (array_diff($ids, array_keys($courantes)) !== []) {
                throw ErrorCode::TermNotFound->problem();
            }

            $sequence = [...$ids, ...array_diff(array_keys($courantes), $ids)];

            foreach ($sequence as $position => $id) {
                if ($courantes[$id]->position === $position) {
                    continue;
                }

                $this->placer($vocabulaire, $id, $position, $courantes[$id]->isPlatform);
            }

            return $this->valeurs->resolved($vocabulaire, includeInactive: true);
        }));
    }

    private function placer(VocabularyKey $vocabulaire, string $id, int $position, bool $plateforme): void
    {
        if ($plateforme) {
            TermOverride::query()->updateOrCreate(['term_id' => $id], ['position' => $position]);

            return;
        }

        $valeur = $this->valeurs->find($id, $vocabulaire) ?? throw ErrorCode::TermNotFound->problem();
        $valeur->position = $position;
        $valeur->save();
    }
}
