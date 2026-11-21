<?php

declare(strict_types=1);

namespace App\Modules\Payments\Console;

use App\Modules\Payments\Actions\ReconcilePayments;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;

final class ReconcilePaymentsCommand extends Command
{
    protected $signature = 'payments:reconcile';

    protected $description = 'Relit au PSP les paiements en ligne en attente et rejoue les confirmations non imputées';

    public function handle(ReconcilePayments $action): int
    {
        $bilan = $action->handle(CarbonImmutable::now());
        $this->info("Paiements resynchronisés : {$bilan['synced']} ; confirmations rejouées : {$bilan['replayed']}.");

        return self::SUCCESS;
    }
}
