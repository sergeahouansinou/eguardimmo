<?php

declare(strict_types=1);

namespace App\Modules\Parties\Actions;

use App\Modules\Catalog\Data\TagData;
use App\Modules\Catalog\PublicApi\Tagger;
use App\Modules\Parties\Models\Party;
use Illuminate\Support\Facades\DB;

final readonly class SyncPartyTags
{
    public function __construct(private Tagger $etiqueteuse) {}

    /**
     * @param  list<string>  $tagIds
     */
    public function handle(Party $party, array $tagIds): void
    {
        $voulues = array_values(array_unique($tagIds));
        $morph = $party->getMorphClass();

        DB::transaction(function () use ($party, $voulues, $morph): void {
            $actuelles = array_map(fn (TagData $etiquette): string => $etiquette->id, $this->etiqueteuse->tagsOf($morph, $party->id));

            $this->etiqueteuse->detach($morph, $party->id, array_values(array_diff($actuelles, $voulues)));
            $this->etiqueteuse->attach($morph, $party->id, array_values(array_diff($voulues, $actuelles)));
        });
    }
}
