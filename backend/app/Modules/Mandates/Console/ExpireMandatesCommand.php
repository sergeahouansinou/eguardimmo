<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Console;

use App\Modules\Mandates\Actions\ExpireMandates;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;

final class ExpireMandatesCommand extends Command
{
    protected $signature = 'mandates:expire';

    protected $description = 'Reconduit les mandats échus à reconduction tacite et fait expirer les autres';

    public function handle(ExpireMandates $expiration): int
    {
        $bilan = $expiration->handle(CarbonImmutable::today());

        $this->info("{$bilan['renewed']} mandat(s) reconduit(s), {$bilan['expired']} expiré(s).");

        return self::SUCCESS;
    }
}
