<?php

declare(strict_types=1);

namespace App\Modules\Charges\Console;

use App\Modules\Charges\Actions\FlagDueRegularizations;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;

final class FlagDueRegularizationsCommand extends Command
{
    protected $signature = 'charges:flag-due';

    protected $description = 'Signale les baux à provisions dont la régularisation des charges est en retard (une alerte par bail et par année)';

    public function handle(FlagDueRegularizations $balayage): int
    {
        $this->info($balayage->handle(CarbonImmutable::today()).' régularisation(s) signalée(s).');

        return self::SUCCESS;
    }
}
