<?php

declare(strict_types=1);

namespace App\Modules\Properties\Console;

use App\Modules\Properties\Actions\VerifyOwnerships;
use Illuminate\Console\Command;

final class VerifyOwnershipsCommand extends Command
{
    protected $signature = 'properties:verify-ownerships';

    protected $description = 'Vérifie que les quotes-parts de propriété de chaque lot ne dépassent pas 100 % par période et par nature de droit';

    public function handle(VerifyOwnerships $controle): int
    {
        $anomalies = $controle->handle();

        foreach ($anomalies as $anomalie) {
            $this->error("[{$anomalie->kind->value}] organisation {$anomalie->organizationId}, lot {$anomalie->unitId} : {$anomalie->detail}");
        }

        if ($anomalies === []) {
            $this->info('Quotes-parts de propriété cohérentes.');

            return self::SUCCESS;
        }

        $this->error(count($anomalies).' anomalie(s) détectée(s).');

        return self::FAILURE;
    }
}
