<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Console;

use App\Modules\Subscriptions\Actions\EndTrials;
use Illuminate\Console\Command;

final class EndTrialsCommand extends Command
{
    protected $signature = 'subscriptions:end-trials';

    protected $description = 'Ramène au plan Gratuit les organisations dont l\'essai est terminé';

    public function handle(EndTrials $fin): int
    {
        $this->info($fin->handle().' essai(s) terminé(s).');

        return self::SUCCESS;
    }
}
