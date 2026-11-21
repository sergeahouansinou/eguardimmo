<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Enums\TenantInvitationStatus;
use App\Modules\Identity\Enums\TenantRevoker;
use App\Modules\Identity\Models\TenantInvitation;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class RevokeTenantInvitations
{
    public function __construct(private RecordAudit $audit) {}

    /**
     * Suppose un contexte d'organisation. Révoque l'invitation en attente ou acceptée de la partie ; sans effet s'il n'y en a pas.
     */
    public function handle(string $partyId, TenantRevoker $par, ?string $acteurId): bool
    {
        return DB::transaction(function () use ($partyId, $par, $acteurId): bool {
            $invitation = TenantInvitation::query()
                ->where('party_id', $partyId)
                ->whereIn('status', [TenantInvitationStatus::Pending, TenantInvitationStatus::Accepted])
                ->lockForUpdate()
                ->first();

            if ($invitation === null) {
                return false;
            }

            $invitation->forceFill([
                'status' => TenantInvitationStatus::Revoked,
                'token_hash' => null,
                'revoked_at' => now(),
                'revoked_by' => $par,
                'revoked_by_user_id' => $acteurId,
            ])->save();

            $this->audit->handle('identity.tenant_invitation.revoked', $acteurId, ['party_id' => $partyId, 'by' => $par->value], $invitation);

            return true;
        });
    }
}
