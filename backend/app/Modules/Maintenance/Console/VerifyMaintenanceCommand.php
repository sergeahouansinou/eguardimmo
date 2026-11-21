<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Console;

use App\Modules\Maintenance\Actions\VerifyMaintenance;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;

final class VerifyMaintenanceCommand extends Command
{
    protected $signature = 'maintenance:verify';

    protected $description = 'Contrôle l\'imputation des factures reçues, les accords au-dessus du plafond et les clôtures';

    public function handle(VerifyMaintenance $controle): int
    {
        $anomalies = $controle->handle(CarbonImmutable::today());

        foreach ($anomalies as $anomalie) {
            $this->error($anomalie);
        }

        $this->info($anomalies === [] ? 'Aucune anomalie.' : count($anomalies).' anomalie(s).');

        return $anomalies === [] ? self::SUCCESS : self::FAILURE;
    }
}
