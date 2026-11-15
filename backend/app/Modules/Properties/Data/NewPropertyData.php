<?php

declare(strict_types=1);

namespace App\Modules\Properties\Data;

use App\Modules\Properties\Enums\PropertyType;

final readonly class NewPropertyData
{
    /**
     * @param  array{line1: string, line2?: string|null, postal_code: string, city: string, country: string}  $address
     * @param  array<string, mixed>  $customFields
     * @param  list<string>  $tagIds
     */
    public function __construct(
        public string $name,
        public PropertyType $type,
        public array $address,
        public array $customFields,
        public array $tagIds,
    ) {}
}
