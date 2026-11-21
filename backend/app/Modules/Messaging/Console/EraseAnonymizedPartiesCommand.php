<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Console;

use App\Modules\Messaging\Actions\EraseAnonymizedParties;
use Illuminate\Console\Command;

final class EraseAnonymizedPartiesCommand extends Command
{
    protected $signature = 'messaging:erase-anonymized-parties';

    protected $description = 'Efface les textes et les pièces des fiches anonymisées dont l\'effacement en file a échoué';

    public function handle(EraseAnonymizedParties $rattrapage): int
    {
        $bilan = $rattrapage->handle();

        foreach ($bilan['failures'] as $echec) {
            $this->error($echec);
        }

        $this->info("{$bilan['erased']} message(s) effacé(s).");

        return $bilan['failures'] === [] ? self::SUCCESS : self::FAILURE;
    }
}
