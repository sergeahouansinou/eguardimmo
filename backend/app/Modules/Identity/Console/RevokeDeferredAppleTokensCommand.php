<?php

declare(strict_types=1);

namespace App\Modules\Identity\Console;

use App\Modules\Identity\Actions\RevokeDeferredAppleTokens;
use Illuminate\Console\Command;

final class RevokeDeferredAppleTokensCommand extends Command
{
    protected $signature = 'identity:revoke-deferred-apple-tokens';

    protected $description = 'Retente la révocation Apple des comptes supprimés dont la révocation a échoué';

    public function handle(RevokeDeferredAppleTokens $revocation): int
    {
        $bilan = $revocation->handle();

        $this->info("Jetons révoqués : {$bilan['revoked']}. Échecs : {$bilan['failed']}.");

        return $bilan['failed'] === 0 ? self::SUCCESS : self::FAILURE;
    }
}
