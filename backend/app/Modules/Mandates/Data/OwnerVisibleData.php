<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Data;

use App\Modules\Identity\Enums\OwnerAccessRole;
use Carbon\CarbonImmutable;

/**
 * Un couple (organisation, mandant) lisible par un compte propriétaire (ADR 0032). `accessUntil` est le dernier jour d'accès,
 * null tant qu'un mandat est actif ou suspendu ; `inGrace` : tous les mandats sont terminés, l'accès est en lecture seule.
 */
final readonly class OwnerVisibleData
{
    public function __construct(
        public string $accessId,
        public string $organizationId,
        public string $mandantPartyId,
        public string $mandantName,
        public OwnerAccessRole $role,
        public ?string $personPartyId,
        public ?CarbonImmutable $accessUntil,
        public bool $inGrace,
    ) {}

    public function canWrite(): bool
    {
        return $this->role !== OwnerAccessRole::CoOwner && ! $this->inGrace;
    }
}
