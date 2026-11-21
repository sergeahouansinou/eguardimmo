<?php

declare(strict_types=1);

namespace App\Modules\Tax\Data;

final readonly class IncomeFacts
{
    /**
     * Ce que les autres modules ont fourni pour une année : montants par bien et par ligne, locaux loués, quotes-parts, et ce qui ne se
     * classe pas ou se contredit.
     *
     * @param  list<FactEntryData>  $entries
     * @param  array<string, string>  $propertyNames  par bien
     * @param  array<string, int>  $premises  locaux loués dans l'année, par bien
     * @param  array<string, list<array{share_bp: int, nature: string}>>  $coOwners  par bien, seulement s'il y a plusieurs propriétaires
     * @param  list<array{code: string, property_id: ?string, amount?: int, detail?: string}>  $warnings
     * @param  list<array{code: string, property_id: string}>  $blockers
     */
    public function __construct(
        public array $entries,
        public array $propertyNames,
        public array $premises,
        public array $coOwners = [],
        public array $warnings = [],
        public array $blockers = [],
    ) {}
}
