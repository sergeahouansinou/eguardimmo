<?php

declare(strict_types=1);

namespace App\Modules\Properties\Actions;

use App\Modules\Catalog\Data\TagData;
use App\Modules\Catalog\PublicApi\Tagger;
use App\Modules\Properties\Models\Property;
use App\Modules\Properties\Models\Unit;
use Illuminate\Support\Facades\DB;

final readonly class SyncTags
{
    public function __construct(private Tagger $etiqueteuse) {}

    /**
     * @param  list<string>  $tagIds
     */
    public function handle(Property|Unit $objet, array $tagIds): void
    {
        $voulues = array_values(array_unique($tagIds));
        $morph = $objet->getMorphClass();

        DB::transaction(function () use ($objet, $voulues, $morph): void {
            $actuelles = array_map(fn (TagData $etiquette): string => $etiquette->id, $this->etiqueteuse->tagsOf($morph, $objet->id));

            $this->etiqueteuse->detach($morph, $objet->id, array_values(array_diff($actuelles, $voulues)));
            $this->etiqueteuse->attach($morph, $objet->id, array_values(array_diff($voulues, $actuelles)));
        });
    }
}
