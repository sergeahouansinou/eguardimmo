<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Console;

use App\Modules\Subscriptions\Support\PlanGrid;
use Illuminate\Console\Command;

final class SeedPlansCommand extends Command
{
    protected $signature = 'subscriptions:seed-plans';

    protected $description = 'Charge la grille de plans de l\'ADR 0013 (plans déjà présents inchangés)';

    public function handle(PlanGrid $grille): int
    {
        $this->info($grille->seed().' plan(s) créé(s).');

        return self::SUCCESS;
    }
}
