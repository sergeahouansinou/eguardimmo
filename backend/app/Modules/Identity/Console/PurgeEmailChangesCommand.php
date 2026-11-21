<?php

declare(strict_types=1);

namespace App\Modules\Identity\Console;

use App\Modules\Identity\Actions\PurgeEmailChanges;
use Illuminate\Console\Command;

final class PurgeEmailChangesCommand extends Command
{
    protected $signature = 'identity:purge-email-changes';

    protected $description = 'Efface les demandes de changement d\'adresse e-mail vieilles de plus de 24 heures';

    public function handle(PurgeEmailChanges $purge): int
    {
        $this->info($purge->handle(now()).' demande(s) de changement d\'adresse effacée(s).');

        return self::SUCCESS;
    }
}
