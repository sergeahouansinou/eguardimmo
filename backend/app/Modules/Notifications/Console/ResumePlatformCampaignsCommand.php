<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Console;

use App\Modules\Notifications\Actions\ResumePlatformCampaigns;
use Illuminate\Console\Command;

final class ResumePlatformCampaignsCommand extends Command
{
    protected $signature = 'notifications:resume-platform-campaigns';

    protected $description = 'Reprend les campagnes de la plateforme interrompues (ADR 0042)';

    public function handle(ResumePlatformCampaigns $reprise): int
    {
        $this->info('Lignes passées à issue inconnue : '.$reprise->handle().'.');

        return self::SUCCESS;
    }
}
