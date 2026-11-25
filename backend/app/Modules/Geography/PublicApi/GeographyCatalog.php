<?php

declare(strict_types=1);

namespace App\Modules\Geography\PublicApi;

use App\Modules\Geography\Actions\SeedCatalog;

/**
 * Référentiel de départ ; rejouable sans doublon (clé : pays + slug).
 */
final readonly class GeographyCatalog
{
    public function __construct(private SeedCatalog $semer) {}

    public function seed(): void
    {
        $this->semer->handle();
    }
}
