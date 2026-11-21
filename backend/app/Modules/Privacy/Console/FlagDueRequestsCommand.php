<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Console;

use App\Modules\Privacy\Actions\FlagDueRequests;
use Illuminate\Console\Command;

final class FlagDueRequestsCommand extends Command
{
    protected $signature = 'privacy:flag-due';

    protected $description = 'Signale les demandes de données personnelles à moins de sept jours de leur échéance';

    public function handle(FlagDueRequests $signalement): int
    {
        $this->info($signalement->handle().' demande(s) signalée(s).');

        return self::SUCCESS;
    }
}
