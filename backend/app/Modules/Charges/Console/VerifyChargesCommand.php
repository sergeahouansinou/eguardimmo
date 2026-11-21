<?php

declare(strict_types=1);

namespace App\Modules\Charges\Console;

use App\Modules\Charges\Actions\VerifyCharges;
use Illuminate\Console\Command;

final class VerifyChargesCommand extends Command
{
    protected $signature = 'charges:verify';

    protected $description = 'Vérifie la cohérence des dépenses et des décomptes de charges et signale toute anomalie, sans rien corriger';

    public function handle(VerifyCharges $controle): int
    {
        $anomalies = $controle->handle();

        foreach ($anomalies as $anomalie) {
            $this->error("[{$anomalie->kind->value}] organisation {$anomalie->organizationId}, objet {$anomalie->subjectId} : {$anomalie->detail}");
        }

        if ($anomalies === []) {
            $this->info('Charges cohérentes.');

            return self::SUCCESS;
        }

        $this->error(count($anomalies).' anomalie(s) détectée(s).');

        return self::FAILURE;
    }
}
