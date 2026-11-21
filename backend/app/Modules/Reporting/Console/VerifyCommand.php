<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Console;

use App\Modules\Reporting\Actions\VerifyReports;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;

final class VerifyCommand extends Command
{
    protected $signature = 'reporting:verify';

    protected $description = 'Contrôle les comptes rendus de gestion publiés et signale toute anomalie';

    public function handle(VerifyReports $action): int
    {
        $anomalies = $action->handle(CarbonImmutable::today());

        foreach ($anomalies as $anomalie) {
            $this->error("{$anomalie['kind']} : organisation {$anomalie['organization']}, compte rendu {$anomalie['report']}.");
        }

        $this->info($anomalies === [] ? 'Comptes rendus publiés conformes.' : count($anomalies).' anomalie(s).');

        return $anomalies === [] ? self::SUCCESS : self::FAILURE;
    }
}
