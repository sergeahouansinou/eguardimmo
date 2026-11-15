<?php

declare(strict_types=1);

namespace App\Modules\Parties\Support;

use App\Modules\Catalog\Data\TagData;
use App\Modules\Catalog\Data\TermData;
use App\Modules\Parties\Models\Party;

final readonly class PartyDetail
{
    /**
     * @param  list<TermData>  $categories
     * @param  list<TagData>  $tags
     */
    public function __construct(
        public Party $party,
        public array $categories,
        public array $tags,
    ) {}
}
