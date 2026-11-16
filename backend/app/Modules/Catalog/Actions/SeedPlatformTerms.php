<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Actions;

use App\Modules\Catalog\Models\Term;
use App\Modules\Catalog\Support\ConcurrentWrite;
use App\Modules\Catalog\Support\PlatformTerms;
use Illuminate\Support\Facades\DB;

/**
 * Idempotent : relancé, il remet à jour les valeurs de la plateforme sans en dupliquer ni toucher à leur archivage.
 */
final readonly class SeedPlatformTerms
{
    public function handle(): void
    {
        ConcurrentWrite::replayOnce(fn () => $this->semer());
    }

    private function semer(): void
    {
        $positions = [];

        DB::transaction(function () use (&$positions): void {
            foreach (PlatformTerms::all() as $ligne) {
                $vocabulaire = $ligne['vocabulary']->value;
                $positions[$vocabulaire] = ($positions[$vocabulaire] ?? -1) + 1;

                Term::query()->updateOrCreate(
                    ['organization_id' => null, 'vocabulary' => $vocabulaire, 'key' => $ligne['key']],
                    [
                        'labels' => ['fr' => $ligne['label']],
                        'semantic_key' => $ligne['semantic'],
                        'position' => $positions[$vocabulaire],
                        'metadata' => $ligne['metadata'] === [] ? null : $ligne['metadata'],
                        'is_system' => true,
                    ],
                );
            }
        });
    }
}
