<?php

declare(strict_types=1);

namespace App\Modules\Parties\Data;

use App\Modules\Parties\Enums\PartyKind;

final readonly class PartyData
{
    /**
     * @param  list<string>  $categories  sens système des catégories de contact (`bailiff`, `craftsman`…)
     */
    public function __construct(
        public string $id,
        public string $displayName,
        public PartyKind $kind,
        public ?string $primaryEmail,
        public array $categories,
        public bool $isAnonymized,
    ) {}
}
