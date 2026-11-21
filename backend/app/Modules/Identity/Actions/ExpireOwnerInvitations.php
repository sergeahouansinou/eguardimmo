<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Enums\OwnerInvitationStatus;
use App\Modules\Identity\Models\OwnerInvitation;
use App\Modules\Identity\Queries\OwnerInvitations;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

final readonly class ExpireOwnerInvitations
{
    public function __construct(
        private OwnerInvitations $invitations,
        private RecordAudit $audit,
        private CurrentOrganization $contexte,
    ) {}

    /**
     * Idempotent : une invitation déjà expirée n'est plus sélectionnée. Efface le jeton et le code hachés.
     */
    public function handle(CarbonInterface $now): int
    {
        $total = 0;

        foreach ($this->invitations->expiredAt($now) as $ligne) {
            $total += $this->contexte->run($ligne->organization_id, fn (): int => DB::transaction(function () use ($ligne): int {
                $invitation = OwnerInvitation::query()->whereKey($ligne->id)->where('status', OwnerInvitationStatus::Pending)->lockForUpdate()->first();

                if ($invitation === null) {
                    return 0;
                }

                $invitation->forceFill($invitation->endedAttributes(OwnerInvitationStatus::Expired))->save();
                $this->audit->handle('identity.owner_invitation.expired', null, ['mandant_party_id' => $invitation->mandant_party_id], $invitation);

                return 1;
            }));
        }

        return $total;
    }
}
