<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Console;

use App\Modules\Messaging\Actions\PurgeConversations;
use App\Modules\Messaging\Actions\PurgeSupportTickets;
use Illuminate\Console\Command;

final class PurgeCommand extends Command
{
    protected $signature = 'messaging:purge';

    protected $description = 'Efface les textes et les pièces des fils et des demandes de support arrivés au terme de leur conservation';

    public function handle(PurgeConversations $fils, PurgeSupportTickets $demandes): int
    {
        $bilanFils = $fils->handle();
        $bilanDemandes = $demandes->handle();

        foreach ($bilanFils['failures'] as $echec) {
            $this->error($echec);
        }

        $this->info("{$bilanFils['purged']} fil(s) purgé(s), {$bilanDemandes['tickets']} demande(s) purgée(s), {$bilanDemandes['attachments']} pièce(s) de support effacée(s).");

        return $bilanFils['failures'] === [] ? self::SUCCESS : self::FAILURE;
    }
}
