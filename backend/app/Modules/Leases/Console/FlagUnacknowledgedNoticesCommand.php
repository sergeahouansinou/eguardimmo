<?php

declare(strict_types=1);

namespace App\Modules\Leases\Console;

use App\Modules\Leases\Actions\FlagUnacknowledgedNotices;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;

final class FlagUnacknowledgedNoticesCommand extends Command
{
    protected $signature = 'leases:flag-unacknowledged-notices';

    protected $description = 'Signale les demandes de congé restées sans accusé de réception dans le délai';

    public function handle(FlagUnacknowledgedNotices $signaler): int
    {
        $this->info($signaler->handle(CarbonImmutable::now()).' demande(s) de congé signalée(s).');

        return self::SUCCESS;
    }
}
