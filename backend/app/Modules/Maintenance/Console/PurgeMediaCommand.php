<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Console;

use App\Modules\Maintenance\Actions\PurgeMedia;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;

final class PurgeMediaCommand extends Command
{
    protected $signature = 'maintenance:purge-media';

    protected $description = 'Purge les photos de locataires échues et efface le texte libre des signalants anonymisés';

    public function handle(PurgeMedia $purge): int
    {
        $bilan = $purge->handle(CarbonImmutable::today());

        $this->info("{$bilan['purged']} photo(s) purgée(s), {$bilan['erased']} demande(s) effacée(s).");

        foreach ($bilan['failures'] as $echec) {
            $this->error($echec);
        }

        return $bilan['failures'] === [] ? self::SUCCESS : self::FAILURE;
    }
}
