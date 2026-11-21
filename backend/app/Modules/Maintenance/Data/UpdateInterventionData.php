<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Data;

/**
 * Champs modifiables d'une intervention ouverte : liste blanche déjà filtrée par la requête.
 */
final readonly class UpdateInterventionData
{
    /**
     * @param  array<string, mixed>  $fields
     */
    public function __construct(
        public int $lockVersion,
        public array $fields,
    ) {}
}
