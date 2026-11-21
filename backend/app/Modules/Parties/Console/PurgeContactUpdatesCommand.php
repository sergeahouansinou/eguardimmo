<?php

declare(strict_types=1);

namespace App\Modules\Parties\Console;

use App\Modules\Parties\Actions\PurgeContactUpdates;
use Illuminate\Console\Command;

final class PurgeContactUpdatesCommand extends Command
{
    protected $signature = 'parties:purge-contact-updates';

    protected $description = 'Efface les demandes de coordonnées de plus de 90 jours';

    public function handle(PurgeContactUpdates $purge): int
    {
        $this->info($purge->handle(now()).' demande(s) de coordonnées effacée(s).');

        return self::SUCCESS;
    }
}
