<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Console;

use App\Modules\Subscriptions\Actions\VerifySubscriptions;
use Illuminate\Console\Command;

final class VerifySubscriptionsCommand extends Command
{
    protected $signature = 'subscriptions:verify';

    protected $description = 'Crée l\'abonnement des organisations qui n\'en ont pas ; échoue si la grille de plans n\'est pas chargée';

    public function handle(VerifySubscriptions $verification): int
    {
        $resultat = $verification->handle();
        $this->info("{$resultat['missing']} organisation(s) sans abonnement, {$resultat['created']} rattrapée(s).");

        if ($resultat['missing'] > $resultat['created']) {
            $this->error('Grille de plans absente : lancez subscriptions:seed-plans.');

            return self::FAILURE;
        }

        return self::SUCCESS;
    }
}
