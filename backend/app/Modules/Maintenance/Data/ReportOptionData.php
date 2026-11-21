<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Data;

/**
 * Ce que le locataire peut choisir pour signaler un problème sur un bail : lots occupés, parties communes, natures de l'organisation.
 */
final readonly class ReportOptionData
{
    /**
     * @param  list<array{id: string, label: string}>  $units
     * @param  list<array{id: string, key: string, label: string}>  $natures
     */
    public function __construct(
        public string $leaseId,
        public string $label,
        public array $units,
        public bool $commonAreaAllowed,
        public array $natures,
    ) {}
}
