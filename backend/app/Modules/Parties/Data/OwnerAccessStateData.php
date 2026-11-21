<?php

declare(strict_types=1);

namespace App\Modules\Parties\Data;

use App\Modules\Identity\Data\OwnerInvitationData;

final readonly class OwnerAccessStateData
{
    /**
     * @param  list<array{id: string, role: string, person_party_id: string|null, email_hint: string|null, linked_at: string}>  $accesses
     * @param  list<OwnerInvitationData>  $invitations
     */
    public function __construct(
        public string $partyId,
        public array $accesses,
        public array $invitations,
    ) {}
}
