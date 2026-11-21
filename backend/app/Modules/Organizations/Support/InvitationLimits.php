<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Support;

use App\Modules\Organizations\Enums\ErrorCode;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Organizations\Models\OrganizationMember;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Chaque invitation ou renvoi envoie un e-mail sous le nom de la plateforme : l'organisation, l'adresse invitée et l'invitation ont
 * chacune leur plafond. Les compteurs sont appliqués dans l'Action, après le contrôle du rôle : un membre sans droit ne peut pas
 * épuiser le quota de l'organisation.
 */
final class InvitationLimits
{
    private const UNE_HEURE = 3600;

    private const UN_JOUR = 86400;

    public function beforeInvite(Organization $organisation, string $email): void
    {
        $this->beforeSending($organisation);
        $this->consume(
            'org-member-invitation-address:'.$organisation->id.':'.hash('sha256', $email),
            $this->limit('address_daily_max', 3),
            self::UN_JOUR,
            ErrorCode::InvitationAddressLimitReached,
        );
    }

    public function beforeResend(Organization $organisation, OrganizationMember $membre): void
    {
        $this->consume(
            'org-member-invitation-resend-delay:'.$membre->id,
            1,
            $this->limit('resend_delay_seconds', 60),
            ErrorCode::InvitationResendTooSoon,
        );
        $this->consume(
            'org-member-invitation-resend:'.$membre->id,
            $this->limit('resend_daily_max', 3),
            self::UN_JOUR,
            ErrorCode::InvitationResendLimitReached,
        );
        $this->beforeSending($organisation);
    }

    private function beforeSending(Organization $organisation): void
    {
        $this->consume('org-member-invitation-hour:'.$organisation->id, $this->limit('organization_hourly_max', 30), self::UNE_HEURE, ErrorCode::InvitationRateLimited);
        $this->consume('org-member-invitation-day:'.$organisation->id, $this->limit('organization_daily_max', 100), self::UN_JOUR, ErrorCode::InvitationDailyLimitReached);
    }

    private function consume(string $cle, int $max, int $dureeSecondes, ErrorCode $refus): void
    {
        if (RateLimiter::tooManyAttempts($cle, $max)) {
            throw $refus->problem(RateLimiter::availableIn($cle));
        }

        RateLimiter::hit($cle, $dureeSecondes);
    }

    private function limit(string $cle, int $defaut): int
    {
        $valeur = config("organizations.invitations.{$cle}");

        return is_int($valeur) && $valeur > 0 ? $valeur : $defaut;
    }
}
