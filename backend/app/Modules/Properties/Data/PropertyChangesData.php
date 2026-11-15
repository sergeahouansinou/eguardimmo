<?php

declare(strict_types=1);

namespace App\Modules\Properties\Data;

use App\Modules\Properties\Enums\PropertyType;

final readonly class PropertyChangesData
{
    /**
     * @param  array{line1: string, line2?: string|null, postal_code: string, city: string, country: string}|null  $address  null : inchangée
     * @param  array<string, mixed>|null  $customFields  null : inchangés
     * @param  list<string>|null  $tagIds  null : inchangées
     */
    public function __construct(
        public int $lockVersion,
        public ?string $name,
        public ?PropertyType $type,
        public ?array $address,
        public ?array $customFields,
        public ?array $tagIds,
    ) {}
}
