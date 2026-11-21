<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Console;

use App\Modules\Messaging\Actions\ExpireSupportAccess;
use Illuminate\Console\Command;

final class ExpireSupportAccessCommand extends Command
{
    protected $signature = 'messaging:expire-support-access';

    protected $description = 'Éteint les accès du support arrivés à terme et les demandes d\'accès restées sans réponse';

    public function handle(ExpireSupportAccess $expiration): int
    {
        $this->info($expiration->handle().' accès éteint(s).');

        return self::SUCCESS;
    }
}
