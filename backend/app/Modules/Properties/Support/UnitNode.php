<?php

declare(strict_types=1);

namespace App\Modules\Properties\Support;

use App\Modules\Catalog\Data\TermData;
use App\Modules\Properties\Models\Unit;

final readonly class UnitNode
{
    /**
     * @param  list<UnitNode>  $annexes
     */
    public function __construct(
        public Unit $unit,
        public TermData $type,
        public array $annexes,
    ) {}
}
