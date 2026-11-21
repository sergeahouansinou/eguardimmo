<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Console;

use App\Modules\Messaging\Actions\ResolveStaleTickets;
use Illuminate\Console\Command;

final class ResolveStaleTicketsCommand extends Command
{
    protected $signature = 'messaging:resolve-stale-tickets';

    protected $description = 'Résout les demandes de support en attente du demandeur depuis plus de 7 jours';

    public function handle(ResolveStaleTickets $resolution): int
    {
        $this->info($resolution->handle().' demande(s) résolue(s).');

        return self::SUCCESS;
    }
}
