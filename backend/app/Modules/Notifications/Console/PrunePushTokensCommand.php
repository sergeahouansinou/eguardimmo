<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Console;

use App\Modules\Notifications\Actions\PrunePushTokens;
use Illuminate\Console\Command;

final class PrunePushTokensCommand extends Command
{
    protected $signature = 'notifications:prune-push-tokens';

    protected $description = 'Révoque les jetons push dont la session mobile a disparu ou expiré';

    public function handle(PrunePushTokens $nettoyage): int
    {
        $this->info($nettoyage->handle().' jeton(s) push révoqué(s).');

        return self::SUCCESS;
    }
}
