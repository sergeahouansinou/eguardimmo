<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Support;

use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Enums\SupportAccessKind;
use App\Modules\Messaging\Enums\SupportAccessStatus;
use App\Modules\Messaging\Models\SupportAccessGrant;
use App\Shared\Audit\PreciseTimestamp;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;

/**
 * Freins à l'accès sans consentement (ADR 0033, décision 9, amendement de la revue du lot 3) : une seule urgence vivante par organisation,
 * pas de nouvelle urgence d'un opérateur sur une organisation tant que la sienne n'a pas été revue par un autre, aucune urgence pendant le
 * délai qui suit une révocation par l'organisation, 3 urgences au plus par organisation et par 24 h.
 */
final class EmergencyAccessLimits
{
    public function assertOpenable(string $operateurId, string $organisationId): void
    {
        $maintenant = now();

        if ($this->urgences($organisationId)->where('status', SupportAccessStatus::Active)->where('expires_at', '>', $maintenant->format(PreciseTimestamp::FORMAT))->exists()) {
            throw ErrorCode::SupportEmergencyOrganizationBusy->problem();
        }

        if ($this->urgences($organisationId)->where('operator_user_id', $operateurId)->whereNull('reviewed_at')->exists()) {
            throw ErrorCode::SupportEmergencyReviewPending->problem();
        }

        $delai = max(0, (int) config('messaging.support.emergency_cooldown_hours'));
        $revocation = $this->urgences($organisationId)
            ->where('status', SupportAccessStatus::Revoked)
            ->where('revoked_at', '>', $maintenant->copy()->subHours($delai)->format(PreciseTimestamp::FORMAT))
            ->orderByDesc('revoked_at')
            ->first();

        if ($revocation?->revoked_at !== null) {
            throw ErrorCode::SupportEmergencyCooldown->problem($this->reessayer($revocation->revoked_at->copy()->addHours($delai)));
        }

        $recentes = $this->urgences($organisationId)
            ->where('requested_at', '>', $maintenant->copy()->subDay()->format(PreciseTimestamp::FORMAT))
            ->orderBy('requested_at')
            ->get(['requested_at']);

        if ($recentes->count() >= SupportRules::ACCES_URGENCE_PLAFOND_PAR_JOUR) {
            $liberee = $recentes->get($recentes->count() - SupportRules::ACCES_URGENCE_PLAFOND_PAR_JOUR)?->requested_at;

            throw ErrorCode::SupportEmergencyLimit->problem($this->reessayer($liberee?->copy()->addDay()));
        }
    }

    /**
     * @return Builder<SupportAccessGrant>
     */
    private function urgences(string $organisationId): Builder
    {
        return SupportAccessGrant::query()->where('organization_id', $organisationId)->where('kind', SupportAccessKind::Emergency);
    }

    /**
     * @return array<string, string>
     */
    private function reessayer(?CarbonInterface $quand): array
    {
        return $quand === null ? [] : ['Retry-After' => (string) max(1, $quand->getTimestamp() - now()->getTimestamp())];
    }
}
