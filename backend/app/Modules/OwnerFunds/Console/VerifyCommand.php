<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Console;

use App\Modules\OwnerFunds\Actions\VerifyOwnerFunds;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;

final class VerifyCommand extends Command
{
    protected $signature = 'ownerfunds:verify';

    protected $description = 'Contrôle les fonds des mandants de chaque organisation et signale toute anomalie';

    public function handle(VerifyOwnerFunds $controle): int
    {
        $anomalies = $controle->handle(CarbonImmutable::today());
        $libelles = [
            VerifyOwnerFunds::ECART => 'Écart de cantonnement',
            VerifyOwnerFunds::TRANSIT => 'Reversements en transit incohérents',
            VerifyOwnerFunds::DEBITEUR => 'Compte mandant débiteur',
        ];

        foreach ($anomalies as $anomalie) {
            $this->error("{$libelles[$anomalie['kind']]} : organisation {$anomalie['organization']}.");
        }

        $this->info($anomalies === [] ? 'Cantonnement couvert.' : count($anomalies).' anomalie(s).');

        return $anomalies === [] ? self::SUCCESS : self::FAILURE;
    }
}
