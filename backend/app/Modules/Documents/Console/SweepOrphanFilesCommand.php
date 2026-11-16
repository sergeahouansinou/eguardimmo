<?php

declare(strict_types=1);

namespace App\Modules\Documents\Console;

use App\Modules\Documents\Actions\SweepOrphanFiles;
use Illuminate\Console\Command;

final class SweepOrphanFilesCommand extends Command
{
    protected $signature = 'documents:sweep-orphans';

    protected $description = 'Supprime les fichiers stockés sans ligne en base, plus anciens que 24 heures, et les journalise';

    public function handle(SweepOrphanFiles $balayage): int
    {
        $supprimes = $balayage->handle();

        foreach ($supprimes as $chemin) {
            $this->line("Fichier orphelin supprimé : {$chemin}");
        }

        $this->info(count($supprimes).' fichier(s) orphelin(s) supprimé(s).');

        return self::SUCCESS;
    }
}
