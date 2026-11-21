<?php

declare(strict_types=1);

namespace App\Modules\Charges\Support;

use App\Modules\Charges\Models\ChargeExercise;

final readonly class ComputedExercise
{
    /**
     * @param  list<array{lease_id: string, reason: string}>  $excluded
     */
    public function __construct(
        public ChargeExercise $exercise,
        public int $statements,
        public array $excluded,
    ) {}
}
