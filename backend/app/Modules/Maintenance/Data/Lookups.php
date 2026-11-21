<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Data;

use App\Modules\Properties\Data\UnitData;

/**
 * Noms de parties et lots lus une fois pour toute une page d'interventions.
 */
final readonly class Lookups
{
    /**
     * @param  array<string, string>  $parties  nom par identifiant de partie
     * @param  array<string, UnitData>  $units
     */
    public function __construct(
        public array $parties,
        public array $units,
    ) {}

    public static function empty(): self
    {
        return new self([], []);
    }
}
