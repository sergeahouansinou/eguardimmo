<?php

declare(strict_types=1);

namespace App\Modules\Documents\Console;

use App\Modules\Documents\Actions\RescanFiles;
use Illuminate\Console\Command;

final class RescanUnverifiableCommand extends Command
{
    protected $signature = 'documents:rescan-unverifiable';

    protected $description = 'Relance l\'analyse antivirale des fichiers restés bloqués (analyseur injoignable, travail perdu)';

    public function handle(RescanFiles $relance): int
    {
        $this->info($relance->handle().' fichier(s) relancé(s).');

        return self::SUCCESS;
    }
}
