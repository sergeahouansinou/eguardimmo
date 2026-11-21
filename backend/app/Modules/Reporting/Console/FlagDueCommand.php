<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Console;

use App\Modules\Reporting\Actions\FlagDueReports;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;

final class FlagDueCommand extends Command
{
    protected $signature = 'reporting:flag-due';

    protected $description = 'Signale les comptes rendus de gestion à produire pour la dernière période échue';

    public function handle(FlagDueReports $action): int
    {
        $signales = $action->handle(CarbonImmutable::today());
        $this->info("{$signales} compte(s) rendu(s) à produire signalé(s).");

        return self::SUCCESS;
    }
}
