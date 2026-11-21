<?php

declare(strict_types=1);

namespace App\Modules\Parties\Queries;

use App\Modules\Identity\Enums\TenantInvitationStatus;
use App\Modules\Identity\PublicApi\TenantInvitations;
use App\Modules\Parties\Data\TenantAccessData;
use App\Modules\Parties\Models\Party;

final readonly class TenantAccesses
{
    public function __construct(private TenantInvitations $invitations) {}

    /**
     * Suppose un contexte d'organisation.
     */
    public function of(Party $party): TenantAccessData
    {
        $invitation = $this->invitations->liveForParty($party->id);

        if ($party->user_id !== null) {
            return new TenantAccessData($party->id, 'linked', $invitation?->emailHint, null, $invitation?->acceptedAt);
        }

        if ($invitation?->status === TenantInvitationStatus::Pending) {
            return new TenantAccessData($party->id, 'invited', $invitation->emailHint, $invitation->expiresAt, null);
        }

        return new TenantAccessData($party->id, 'none', null, null, null);
    }
}
