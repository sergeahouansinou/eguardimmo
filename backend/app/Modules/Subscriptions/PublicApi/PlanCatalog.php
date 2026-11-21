<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\PublicApi;

use App\Modules\Subscriptions\Support\PlanGrid;

final readonly class PlanCatalog
{
    public function __construct(private PlanGrid $grille) {}

    public function seed(): void
    {
        $this->grille->seed();
    }
}
