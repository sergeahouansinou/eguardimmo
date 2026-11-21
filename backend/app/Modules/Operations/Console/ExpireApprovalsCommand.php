<?php

declare(strict_types=1);

namespace App\Modules\Operations\Console;

use App\Modules\Operations\Actions\ExpireApprovals;
use Illuminate\Console\Command;

final class ExpireApprovalsCommand extends Command
{
    protected $signature = 'operations:expire-approvals';

    protected $description = 'Expire les demandes de double validation en attente dont l\'échéance est dépassée';

    public function handle(ExpireApprovals $expiration): int
    {
        $this->info($expiration->handle().' demande(s) expirée(s).');

        return self::SUCCESS;
    }
}
