<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Console;

use App\Modules\OwnerFunds\Actions\ExpirePayoutAccountRequests;
use Illuminate\Console\Command;

final class ExpirePayoutRequestsCommand extends Command
{
    protected $signature = 'ownerfunds:expire-payout-requests';

    protected $description = 'Passe « expirées » les demandes de compte de paiement dont le code est périmé ou sans suite';

    public function handle(ExpirePayoutAccountRequests $expiration): int
    {
        $this->info($expiration->handle().' demande(s) expirée(s).');

        return self::SUCCESS;
    }
}
