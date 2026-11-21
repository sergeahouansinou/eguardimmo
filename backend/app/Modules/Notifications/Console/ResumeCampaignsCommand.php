<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Console;

use App\Modules\Notifications\Actions\ResumeCampaigns;
use Illuminate\Console\Command;

final class ResumeCampaignsCommand extends Command
{
    protected $signature = 'notifications:resume-campaigns';

    protected $description = "Rattrape les diffusions en cours : lignes d'issue inconnue, paquets perdus";

    public function handle(ResumeCampaigns $action): int
    {
        $this->info($action->handle()." ligne(s) d'issue inconnue reprises.");

        return self::SUCCESS;
    }
}
