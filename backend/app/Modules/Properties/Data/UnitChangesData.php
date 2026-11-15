<?php

declare(strict_types=1);

namespace App\Modules\Properties\Data;

final readonly class UnitChangesData
{
    /**
     * @param  array<string, mixed>  $fields  colonnes transmises seulement : parent_unit_id, unit_type_term_id, reference, floor, surface_hundredths
     * @param  array<string, mixed>|null  $characteristics  null : inchangées
     * @param  array<string, mixed>|null  $customFields  null : inchangés
     * @param  list<string>|null  $tagIds  null : inchangées
     */
    public function __construct(
        public int $lockVersion,
        public array $fields,
        public ?array $characteristics,
        public ?array $customFields,
        public ?array $tagIds,
    ) {}
}
