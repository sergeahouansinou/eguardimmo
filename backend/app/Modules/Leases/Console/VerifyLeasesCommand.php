<?php

declare(strict_types=1);

namespace App\Modules\Leases\Console;

use App\Modules\Leases\Actions\VerifyLeases;
use Illuminate\Console\Command;

final class VerifyLeasesCommand extends Command
{
    protected $signature = 'leases:verify';

    protected $description = 'Relève les baux incohérents (recoupement de lots, bail signé incomplet, lot archivé, composantes) sans rien modifier';

    public function handle(VerifyLeases $controle): int
    {
        $anomalies = $controle->handle();

        foreach ($anomalies as $anomalie) {
            $this->error("[{$anomalie->kind->value}] organisation {$anomalie->organizationId}, bail {$anomalie->leaseId} : {$anomalie->detail}");
        }

        if ($anomalies === []) {
            $this->info('Baux cohérents.');

            return self::SUCCESS;
        }

        $this->error(count($anomalies).' anomalie(s) détectée(s).');

        return self::FAILURE;
    }
}
