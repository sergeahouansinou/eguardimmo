<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Console;

use App\Modules\Notifications\Actions\DispatchDueCampaigns;
use Illuminate\Console\Command;

final class DispatchCampaignsCommand extends Command
{
    protected $signature = 'notifications:dispatch-campaigns';

    protected $description = "Lance les diffusions programmées dont l'heure est venue";

    public function handle(DispatchDueCampaigns $action): int
    {
        $this->info($action->handle().' diffusion(s) démarrée(s).');

        return self::SUCCESS;
    }
}
