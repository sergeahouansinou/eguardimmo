<?php

declare(strict_types=1);

namespace App\Modules\Properties\Support;

use App\Modules\Catalog\Data\TagData;
use App\Modules\Catalog\Data\TermData;
use App\Modules\Properties\Models\Unit;

final readonly class UnitView
{
    /**
     * @param  list<TagData>  $tags
     */
    public function __construct(
        public Unit $unit,
        public TermData $type,
        public array $tags,
    ) {}
}
