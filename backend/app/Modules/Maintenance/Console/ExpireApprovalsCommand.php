<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Console;

use App\Modules\Maintenance\Actions\ExpireApprovals;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;

final class ExpireApprovalsCommand extends Command
{
    protected $signature = 'maintenance:expire-approvals';

    protected $description = 'Expire les demandes d\'accord du mandant restées sans réponse après leur échéance';

    public function handle(ExpireApprovals $expiration): int
    {
        $bilan = $expiration->handle(CarbonImmutable::now());

        $this->info("{$bilan['expired']} demande(s) d'accord expirée(s).");

        foreach ($bilan['failures'] as $echec) {
            $this->error($echec);
        }

        return $bilan['failures'] === [] ? self::SUCCESS : self::FAILURE;
    }
}
