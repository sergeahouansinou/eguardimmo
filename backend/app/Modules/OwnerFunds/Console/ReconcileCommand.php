<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Console;

use App\Modules\OwnerFunds\Actions\ReconcileOwnerFunds;
use Illuminate\Console\Command;

final class ReconcileCommand extends Command
{
    protected $signature = 'ownerfunds:reconcile';

    protected $description = 'Signale les échéances sous mandat non routées vers les fonds des mandants (ne corrige rien)';

    public function handle(ReconcileOwnerFunds $controle): int
    {
        $anomalies = $controle->handle();

        foreach ($anomalies as $organisation => $nombre) {
            $this->error("Organisation {$organisation} : {$nombre} échéance(s) sous mandat non routée(s).");
        }

        $this->info($anomalies === [] ? 'Aucune échéance non routée.' : count($anomalies).' organisation(s) en anomalie.');

        return $anomalies === [] ? self::SUCCESS : self::FAILURE;
    }
}
