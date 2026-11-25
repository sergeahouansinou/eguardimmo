<?php

declare(strict_types=1);

namespace App\Modules\Listings\PublicApi;

use App\Modules\Listings\Actions\SeedDemoListings;

/**
 * Annonces illustratives pour le développement ; le seeder qui l'appelle refuse de tourner en production.
 */
final readonly class DemoListings
{
    public function __construct(private SeedDemoListings $semer) {}

    public function seed(string $organizationId): int
    {
        return $this->semer->handle($organizationId);
    }
}
