<?php

declare(strict_types=1);

namespace App\Modules\Identity\Console;

use App\Modules\Identity\Actions\ExpireOwnerInvitations;
use Illuminate\Console\Command;

final class ExpireOwnerInvitationsCommand extends Command
{
    protected $signature = 'identity:expire-owner-invitations';

    protected $description = 'Fait expirer les invitations propriétaire échues et efface leur jeton et leur code';

    public function handle(ExpireOwnerInvitations $expiration): int
    {
        $this->info($expiration->handle(now()).' invitation(s) propriétaire expirée(s).');

        return self::SUCCESS;
    }
}
