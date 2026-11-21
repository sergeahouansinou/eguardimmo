<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Data;

final readonly class AudienceMember
{
    /**
     * @param  array<string, string>  $mergeValues  champs de fusion remplis par le serveur
     */
    public function __construct(
        public string $partyId,
        public ?string $email,
        public ?string $accountId,
        public ?string $leaseId,
        public ?string $propertyId,
        public ?string $propertyName,
        public array $mergeValues,
    ) {}
}
