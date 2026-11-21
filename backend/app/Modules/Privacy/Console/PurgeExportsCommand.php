<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Console;

use App\Modules\Privacy\Actions\PurgeExpiredExports;
use Illuminate\Console\Command;

final class PurgeExportsCommand extends Command
{
    protected $signature = 'privacy:purge-exports';

    protected $description = 'Supprime les exports de données personnelles dont la durée de téléchargement est dépassée';

    public function handle(PurgeExpiredExports $purge): int
    {
        $this->info($purge->handle().' export(s) supprimé(s).');

        return self::SUCCESS;
    }
}
