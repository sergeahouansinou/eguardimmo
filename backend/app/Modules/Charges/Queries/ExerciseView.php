<?php

declare(strict_types=1);

namespace App\Modules\Charges\Queries;

use App\Modules\Charges\Models\ChargeConsumption;
use App\Modules\Charges\Models\ChargeExercise;
use App\Modules\Charges\Models\ChargeItem;
use App\Modules\Charges\Models\ChargeItemSource;
use App\Modules\Charges\Models\ChargeStatement;
use Illuminate\Support\Collection;

final readonly class ExerciseView
{
    /**
     * @param  Collection<int, ChargeItem>  $items
     * @param  array<string, list<ChargeItemSource>>  $sources  par poste
     * @param  array<string, list<ChargeConsumption>>  $consumptions  par poste
     * @param  Collection<int, ChargeStatement>  $statements
     * @param  array<string, int>  $ownerShares  reste au propriétaire par poste, en unités mineures
     */
    public function __construct(
        public ChargeExercise $exercise,
        public Collection $items,
        public array $sources,
        public array $consumptions,
        public Collection $statements,
        public array $ownerShares,
    ) {}
}
