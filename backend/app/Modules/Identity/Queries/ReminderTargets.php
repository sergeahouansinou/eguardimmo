<?php

declare(strict_types=1);

namespace App\Modules\Identity\Queries;

use App\Modules\Identity\Enums\TenantInvitationStatus;
use App\Modules\Identity\Models\TenantInvitation;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\PublicApi\ProfileRegistry;
use App\Shared\Reminders\ReminderHit;
use App\Shared\Reminders\ReminderWindow;
use App\Shared\Tenancy\AcrossOrganizations;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

/**
 * Déclencheurs de rappel portés par les comptes et les invitations (ADR 0042).
 */
final readonly class ReminderTargets
{
    public function __construct(
        private AccountActivity $activite,
        private ProfileRegistry $profils,
    ) {}

    /**
     * @return iterable<ReminderHit> départ : la dernière activité du compte
     */
    public function inactiveAccounts(ReminderWindow $fenetre): iterable
    {
        $comptes = $this->activite->seenSince($this->activite->idleSince($fenetre->to), $fenetre->from)
            ->whereNotNull('email_verified_at')->whereNull('suspended_at')
            ->select(['users.id', 'users.created_at', 'users.last_login_at']);

        foreach ($comptes->lazyById(500, 'users.id', 'id')->chunk(500) as $paquet) {
            $liste = array_values($paquet->all());

            foreach ($this->activite->lastSeen($liste) as $id => $depuis) {
                yield new ReminderHit((string) $id, $depuis, accountId: (string) $id);
            }
        }
    }

    /**
     * @return iterable<ReminderHit> départ : l'inscription
     */
    public function unverifiedEmails(ReminderWindow $fenetre): iterable
    {
        return User::query()->whereNull('email_verified_at')->whereNull('suspended_at')
            ->whereBetween('created_at', [$fenetre->from, $fenetre->to])
            ->select(['id', 'created_at'])->lazyById(500)
            ->map(fn (User $compte): ReminderHit => new ReminderHit($compte->id, CarbonImmutable::parse($compte->getAttribute('created_at')), accountId: $compte->id));
    }

    /**
     * @return iterable<ReminderHit> départ : la confirmation de l'adresse
     */
    public function accountsWithoutSpace(ReminderWindow $fenetre): iterable
    {
        return User::query()->whereNull('intended_profile')->whereNull('suspended_at')
            ->whereBetween('email_verified_at', [$fenetre->from, $fenetre->to])
            ->select(['id', 'email_verified_at'])->lazyById(500)
            ->filter(fn (User $compte): bool => $this->profils->profilesFor($compte->id) === [])
            ->map(fn (User $compte): ReminderHit => new ReminderHit($compte->id, CarbonImmutable::parse($compte->email_verified_at), accountId: $compte->id));
    }

    /**
     * @return iterable<ReminderHit> départ : l'envoi de l'invitation
     */
    public function pendingInvitations(ReminderWindow $fenetre): iterable
    {
        return AcrossOrganizations::query(TenantInvitation::class)
            ->where('status', TenantInvitationStatus::Pending->value)
            ->where('expires_at', '>', CarbonImmutable::now())
            ->where(fn (Builder $q): Builder => $q
                ->where('created_at', '>=', $fenetre->from->format('Y-m-d H:i:s.u'))
                ->where('created_at', '<=', $fenetre->to->format('Y-m-d H:i:s.u')))
            ->select(['id', 'organization_id', 'created_at'])->lazyById(500)
            ->map(fn (TenantInvitation $invitation): ReminderHit => new ReminderHit(
                $invitation->id,
                CarbonImmutable::parse($invitation->created_at),
                organizationId: $invitation->organization_id,
            ));
    }
}
