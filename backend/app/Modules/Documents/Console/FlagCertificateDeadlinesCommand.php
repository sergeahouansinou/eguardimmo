<?php

declare(strict_types=1);

namespace App\Modules\Documents\Console;

use App\Modules\Documents\Actions\FlagCertificateDeadlines;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;

final class FlagCertificateDeadlinesCommand extends Command
{
    protected $signature = 'documents:flag-certificates';

    protected $description = 'Signale les pièces à renouveler ou expirées (événement consommé par les notifications)';

    public function handle(FlagCertificateDeadlines $balayage): int
    {
        $this->info($balayage->handle(CarbonImmutable::today()).' pièce(s) signalée(s).');

        return self::SUCCESS;
    }
}
