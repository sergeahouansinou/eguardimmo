<?php

declare(strict_types=1);

namespace App\Modules\Parties\Actions;

use App\Modules\Identity\Enums\ErrorCode as IdentityErrorCode;
use App\Modules\Identity\PublicApi\OwnerInvitations;
use App\Modules\Parties\Data\LinkedOwnerData;
use App\Modules\Parties\Enums\ErrorCode;
use App\Modules\Parties\Enums\OwnerAccessStatus;
use App\Modules\Parties\Models\OwnerAccess;
use App\Modules\Parties\Models\Party;
use App\Modules\Parties\Notifications\OwnerLinkAlertNotification;
use App\Modules\Parties\Queries\OwnerAccesses;
use App\Modules\Parties\Queries\PartySummaries;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

final readonly class AcceptOwnerInvitation
{
    public function __construct(
        private OwnerInvitations $invitations,
        private OwnerAccesses $acces,
        private PartySummaries $resumes,
        private CurrentOrganization $contexte,
        private RecordAudit $audit,
    ) {}

    /**
     * Le code d'appariement est vérifié d'abord, hors transaction : un essai raté reste compté. L'acceptation de l'invitation
     * (adresse confirmée, consentement) et la création de l'accès sont ensuite une seule transaction.
     */
    public function handle(string $userId, #[\SensitiveParameter] string $jeton, #[\SensitiveParameter] string $code, bool $consent): LinkedOwnerData
    {
        if (! $consent) {
            throw IdentityErrorCode::OwnerInvitationConsentRequired->problem();
        }

        $this->invitations->verifyCode($userId, $jeton, $code);
        $cible = $this->invitations->preview($userId, $jeton);

        return $this->contexte->run($cible->organizationId, fn (): LinkedOwnerData => DB::transaction(function () use ($userId, $jeton, $code, $consent, $cible): LinkedOwnerData {
            $mandant = Party::query()->whereKey($cible->mandantPartyId)->lockForUpdate()->first();

            if ($mandant === null || $mandant->isAnonymized() || $mandant->archived_at !== null || ! $this->personneValide($cible->personPartyId)) {
                throw IdentityErrorCode::OwnerInvitationInvalid->problem();
            }

            $invitation = $this->invitations->consume($userId, $jeton, $code, $consent);

            if ($this->acces->existsActive($mandant->id, $userId)) {
                throw ErrorCode::OwnerAccessAlreadyLinked->problem();
            }

            if ($this->acces->countActiveOfMandant($mandant->id) >= $this->plafond()) {
                throw ErrorCode::OwnerAccessLimitReached->problem();
            }

            $acces = OwnerAccess::query()->create([
                'mandant_party_id' => $mandant->id,
                'user_id' => $userId,
                'role' => $invitation->role,
                'person_party_id' => $invitation->personPartyId,
                'status' => OwnerAccessStatus::Active,
                'invitation_id' => $invitation->id,
                'consent_version' => $invitation->consentVersion,
                'consented_at' => $invitation->acceptedAt ?? now(),
                'identity_attested_by_user_id' => $invitation->identityAttestedByUserId,
                'identity_attested_at' => $invitation->identityAttestedAt,
            ]);
            $this->audit->handle('parties.owner_access.linked', $userId, ['invitation_id' => $invitation->id, 'role' => $invitation->role->value, 'mandant_party_id' => $mandant->id], $acces);

            $principale = $this->resumes->one($mandant->id)->primaryEmail;

            if ($principale !== null) {
                Notification::route('mail', $principale)->notify(new OwnerLinkAlertNotification($invitation->organizationName, OwnerLinkAlertNotification::LINKED));
            }

            return new LinkedOwnerData($acces->id, $invitation->organizationId, $invitation->organizationName, $invitation->role);
        }));
    }

    private function personneValide(?string $personPartyId): bool
    {
        if ($personPartyId === null) {
            return true;
        }

        $personne = Party::query()->find($personPartyId);

        return $personne !== null && ! $personne->isAnonymized() && $personne->archived_at === null;
    }

    private function plafond(): int
    {
        $max = config('parties.owner_access_max_per_mandant');

        return is_int($max) && $max > 0 ? $max : 5;
    }
}
