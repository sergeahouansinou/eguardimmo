<?php

declare(strict_types=1);

namespace App\Modules\Banking\Console;

use App\Modules\Banking\Actions\VerifyBanking;
use Illuminate\Console\Command;

final class VerifyCommand extends Command
{
    protected $signature = 'banking:verify';

    protected $description = 'Contrôle les comptes bancaires suivis (pointages, continuité des relevés, virements internes) et signale toute anomalie';

    public function handle(VerifyBanking $controle): int
    {
        $anomalies = $controle->handle();

        foreach ($anomalies as $anomalie) {
            $this->error("{$anomalie['kind']} : organisation {$anomalie['organization']}, compte {$anomalie['account']}.");
        }

        $this->info($anomalies === [] ? 'Banque cohérente.' : count($anomalies).' anomalie(s).');

        return $anomalies === [] ? self::SUCCESS : self::FAILURE;
    }
}
