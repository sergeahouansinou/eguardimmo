<?php

declare(strict_types=1);

namespace App\Modules\Rent\Console;

use App\Modules\Rent\Actions\RunDailyBilling;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;

final class GenerateInstallmentsCommand extends Command
{
    protected $signature = 'rent:generate';

    protected $description = 'Génère les appels de loyer manquants des baux signés et signale les échéances impayées';

    public function handle(RunDailyBilling $facturation): int
    {
        $bilan = $facturation->handle(CarbonImmutable::today());

        $this->info("{$bilan['leases']} bail(baux) examiné(s), {$bilan['created']} échéance(s) générée(s), {$bilan['overdue']} impayé(s) signalé(s).");

        foreach ($bilan['failures'] as $echec) {
            $this->error($echec);
        }

        return $bilan['failures'] === [] ? self::SUCCESS : self::FAILURE;
    }
}
