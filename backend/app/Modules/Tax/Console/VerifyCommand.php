<?php

declare(strict_types=1);

namespace App\Modules\Tax\Console;

use App\Modules\Tax\Actions\VerifyTaxSummaries;
use Illuminate\Console\Command;

final class VerifyCommand extends Command
{
    protected $signature = 'tax:verify';

    protected $description = 'Contrôle les synthèses fiscales figées et signale toute anomalie';

    public function handle(VerifyTaxSummaries $action): int
    {
        $anomalies = $action->handle();

        foreach ($anomalies as $anomalie) {
            $this->error("{$anomalie['kind']} : organisation {$anomalie['organization']}, synthèse {$anomalie['summary']}.");
        }

        $this->info($anomalies === [] ? 'Synthèses fiscales conformes.' : count($anomalies).' anomalie(s).');

        return $anomalies === [] ? self::SUCCESS : self::FAILURE;
    }
}
