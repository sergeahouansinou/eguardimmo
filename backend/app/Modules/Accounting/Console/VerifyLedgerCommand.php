<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Console;

use App\Modules\Accounting\Actions\VerifyLedgerIntegrity;
use Illuminate\Console\Command;

final class VerifyLedgerCommand extends Command
{
    protected $signature = 'accounting:verify-ledger';

    protected $description = 'Vérifie l\'équilibre et la numérotation de toutes les écritures du grand livre et signale toute anomalie';

    public function handle(VerifyLedgerIntegrity $controle): int
    {
        $anomalies = $controle->handle();

        foreach ($anomalies as $anomalie) {
            $this->error("[{$anomalie->kind->value}] organisation {$anomalie->organizationId} : {$anomalie->detail}");
        }

        if ($anomalies === []) {
            $this->info('Grand livre cohérent.');

            return self::SUCCESS;
        }

        $this->error(count($anomalies).' anomalie(s) détectée(s).');

        return self::FAILURE;
    }
}
