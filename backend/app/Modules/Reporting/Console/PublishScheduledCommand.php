<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Console;

use App\Modules\Reporting\Actions\PublishScheduledReports;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;

final class PublishScheduledCommand extends Command
{
    protected $signature = 'reporting:publish-scheduled';

    protected $description = 'Publie les comptes rendus de gestion dont la publication est planifiée';

    public function handle(PublishScheduledReports $action): int
    {
        $bilan = $action->handle(CarbonImmutable::now());
        $this->info("{$bilan['published']} publié(s), {$bilan['failed']} refusé(s).");

        return $bilan['failed'] === 0 ? self::SUCCESS : self::FAILURE;
    }
}
