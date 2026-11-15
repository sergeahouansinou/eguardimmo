<?php

declare(strict_types=1);

namespace App\Modules\Catalog\PublicApi;

use App\Modules\Catalog\Actions\SeedPlatformTerms;

/**
 * Point d'entrée du seeder racine : charge les valeurs de la plateforme, sans contexte d'organisation.
 */
final readonly class PlatformCatalog
{
    public function __construct(private SeedPlatformTerms $semer) {}

    public function seed(): void
    {
        $this->semer->handle();
    }
}
