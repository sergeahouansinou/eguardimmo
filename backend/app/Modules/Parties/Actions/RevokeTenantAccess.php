<?php

declare(strict_types=1);

namespace App\Modules\Parties\Actions;

use App\Modules\Identity\Enums\TenantRevoker;
use App\Modules\Identity\PublicApi\TenantInvitations;
use App\Modules\Parties\Enums\ErrorCode;
use App\Modules\Parties\Models\Party;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class RevokeTenantAccess
{
    public function __construct(
        private TenantInvitations $invitations,
        private RecordAudit $audit,
    ) {}

    /**
     * Révocation par l'organisation ou par le titulaire du compte rattaché ; `$acteurId` est l'auteur dans les deux cas. Suppose un contexte d'organisation.
     * Retire le rattachement et révoque l'invitation en attente ou acceptée ; l'historique du bail n'est pas touché.
     */
    public function handle(Party $party, TenantRevoker $par, string $acteurId): void
    {
        DB::transaction(function () use ($party, $par, $acteurId): void {
            $partie = Party::query()->whereKey($party->id)->lockForUpdate()->firstOrFail();

            if ($par === TenantRevoker::Account && $partie->user_id !== $acteurId) {
                throw ErrorCode::TenantAccessNotFound->problem();
            }

            $rattachee = $partie->user_id !== null;

            if ($rattachee) {
                $ancien = $partie->user_id;
                $partie->forceFill(['user_id' => null])->save();
                $this->audit->handle('parties.tenant_access.unlinked', $acteurId, ['by' => $par->value, 'user_id' => $ancien], $partie);
            }

            $invitationRevoquee = $this->invitations->revokeForParty($partie->id, $par, $acteurId);

            if (! $rattachee && ! $invitationRevoquee) {
                throw ErrorCode::TenantAccessNotFound->problem();
            }
        });
    }
}
