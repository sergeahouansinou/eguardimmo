<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Console;

use App\Modules\Notifications\Actions\PurgeCampaigns;
use Illuminate\Console\Command;

final class PurgeCampaignsCommand extends Command
{
    protected $signature = 'notifications:purge-campaigns';

    protected $description = 'Efface le contenu des diffusions de plus de 3 ans et les adresses des envois de plus de 13 mois';

    public function handle(PurgeCampaigns $purge): int
    {
        $resultat = $purge->handle();
        $this->info("{$resultat['campaigns']} diffusion(s) effacée(s), {$resultat['deliveries']} adresse(s) d'envoi effacée(s).");

        foreach ($resultat['failures'] as $echec) {
            $this->error($echec);
        }

        return $resultat['failures'] === [] ? self::SUCCESS : self::FAILURE;
    }
}
