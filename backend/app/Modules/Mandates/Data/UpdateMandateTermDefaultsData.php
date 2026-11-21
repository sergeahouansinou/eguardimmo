<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Data;

final readonly class UpdateMandateTermDefaultsData
{
    /**
     * @param  int|null  $lockVersion  nul à la première écriture seulement
     */
    public function __construct(
        public ?int $lockVersion,
        public NewMandateTermData $terms,
    ) {}
}
