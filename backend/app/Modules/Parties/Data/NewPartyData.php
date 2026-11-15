<?php

declare(strict_types=1);

namespace App\Modules\Parties\Data;

use App\Modules\Parties\Enums\PartyKind;

final readonly class NewPartyData
{
    /**
     * @param  array{line1: string, line2?: string|null, postal_code: string, city: string, country: string}|null  $address
     * @param  array<string, mixed>  $customFields
     * @param  list<string>  $categoryIds
     * @param  list<string>  $tagIds
     */
    public function __construct(
        public PartyKind $kind,
        public ?string $lastName,
        public ?string $firstName,
        public ?string $companyName,
        public ?string $legalFormTermId,
        public ?string $birthDate,
        public ?array $address,
        public string $language,
        public array $customFields,
        public array $categoryIds,
        public array $tagIds,
    ) {}
}
