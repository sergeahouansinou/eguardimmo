<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Console;

use App\Modules\Invoicing\Actions\FlagOverdueInvoices;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;

final class FlagOverdueInvoicesCommand extends Command
{
    protected $signature = 'invoices:flag-overdue';

    protected $description = 'Signale une fois chaque facture émise échue et non soldée';

    public function handle(FlagOverdueInvoices $retards): int
    {
        $bilan = $retards->handle(CarbonImmutable::today());

        $this->info("{$bilan['flagged']} facture(s) échue(s) signalée(s).");

        foreach ($bilan['failures'] as $echec) {
            $this->error($echec);
        }

        return $bilan['failures'] === [] ? self::SUCCESS : self::FAILURE;
    }
}
