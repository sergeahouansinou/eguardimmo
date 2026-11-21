<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Enums\OwnerInvitationStatus;
use App\Modules\Identity\Enums\OwnerRevoker;
use App\Modules\Identity\Models\OwnerInvitation;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class RevokeOwnerInvitation
{
    public function __construct(private RecordAudit $audit) {}

    /**
     * Suppose un contexte d'organisation. Révoque les invitations en attente désignées par leur identifiant, ou rattachées
     * aux parties données (mandant ou personne) ; renvoie le nombre d'invitations révoquées.
     *
     * @param  list<string>  $invitationIds
     * @param  list<string>  $partyIds
     */
    public function handle(array $invitationIds, array $partyIds, OwnerRevoker $par, ?string $acteurId): int
    {
        if ($invitationIds === [] && $partyIds === []) {
            return 0;
        }

        return DB::transaction(function () use ($invitationIds, $partyIds, $par, $acteurId): int {
            $invitations = OwnerInvitation::query()
                ->where('status', OwnerInvitationStatus::Pending)
                ->where(function ($q) use ($invitationIds, $partyIds): void {
                    $q->whereIn('id', $invitationIds)->orWhereIn('mandant_party_id', $partyIds)->orWhereIn('person_party_id', $partyIds);
                })
                ->lockForUpdate()
                ->get();

            foreach ($invitations as $invitation) {
                $invitation->forceFill([
                    ...$invitation->endedAttributes(OwnerInvitationStatus::Revoked),
                    'revoked_at' => now(),
                    'revoked_by' => $par,
                    'revoked_by_user_id' => $acteurId,
                ])->save();

                $this->audit->handle('identity.owner_invitation.revoked', $acteurId, ['mandant_party_id' => $invitation->mandant_party_id, 'by' => $par->value], $invitation);
            }

            return $invitations->count();
        });
    }
}
