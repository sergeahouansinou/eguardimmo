<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\Geography\PublicApi\GeographyCatalog;
use App\Modules\Listings\PublicApi\DemoListings;
use Illuminate\Database\Seeder;
use RuntimeException;

/**
 * Annonces illustratives pour développer SeBook : `MARKETPLACE_DEMO_ORGANIZATION=<id> php artisan db:seed --class=MarketplaceDemoSeeder`.
 * DatabaseSeeder ne l'appelle pas (il désactive les événements Eloquent, dont dépend le cloisonnement) ; il ne tourne que dans les environnements local et testing.
 */
final class MarketplaceDemoSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local', 'testing')) {
            throw new RuntimeException('MarketplaceDemoSeeder ne s\'exécute que dans les environnements local et testing.');
        }

        $organisation = config('marketplace.demo_organization_id');

        if (! is_string($organisation) || $organisation === '') {
            throw new RuntimeException('Renseigner MARKETPLACE_DEMO_ORGANIZATION (identifiant d\'une organisation existante).');
        }

        app(GeographyCatalog::class)->seed();

        $creees = app(DemoListings::class)->seed($organisation);

        $this->command?->info("{$creees} annonce(s) de démonstration créée(s).");
    }
}
