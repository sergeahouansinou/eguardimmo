<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Enums\EmergencyBasis;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Enums\SupportAccessKind;
use App\Modules\Messaging\Enums\SupportAccessScope;
use App\Modules\Messaging\Enums\SupportAccessStatus;
use App\Modules\Messaging\Enums\TicketStatus;
use App\Modules\Messaging\Events\SupportAccessEmergencyOpened;
use App\Modules\Messaging\Models\SupportAccessGrant;
use App\Modules\Messaging\Models\SupportTicket;
use App\Modules\Messaging\Support\EmergencyAccessLimits;
use App\Modules\Messaging\Support\OperationLocks;
use App\Modules\Messaging\Support\SupportRules;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

/**
 * Accès sans consentement (ADR 0033, décision 9) : incident de sécurité ou réquisition légale, une heure, `settings` et `team`
 * seulement, l'organisation est prévenue aussitôt et un second opérateur le passe en revue. Les freins (`EmergencyAccessLimits`) se
 * vérifient sous un verrou par organisation, car ils comptent des lignes de plusieurs demandes.
 */
final readonly class OpenEmergencyAccess
{
    public function __construct(private RecordAudit $audit, private EmergencyAccessLimits $limites, private OperationLocks $verrous) {}

    public function handle(User $operateur, SupportTicket $ticket, EmergencyBasis $fondement, string $motif): SupportAccessGrant
    {
        $organisationId = $ticket->organization_id ?? throw ErrorCode::SupportAccessOrganizationRequired->problem();

        return $this->verrous->run('support-emergency:'.$organisationId, fn (): SupportAccessGrant => DB::transaction(fn (): SupportAccessGrant => $this->ouvrir($operateur, $ticket, $organisationId, $fondement, $motif)));
    }

    private function ouvrir(User $operateur, SupportTicket $ticket, string $organisationId, EmergencyBasis $fondement, string $motif): SupportAccessGrant
    {
        $demande = SupportTicket::query()->whereKey($ticket->id)->lockForUpdate()->firstOrFail();

        if ($demande->status === TicketStatus::Resolved) {
            throw ErrorCode::TicketResolved->problem();
        }

        $vivant = SupportAccessGrant::query()
            ->where('support_ticket_id', $demande->id)
            ->where('kind', SupportAccessKind::Emergency)
            ->where('status', SupportAccessStatus::Active)
            ->get()
            ->contains(fn (SupportAccessGrant $acces): bool => $acces->isLive());

        if ($vivant) {
            throw ErrorCode::SupportAccessAlreadyOpen->problem();
        }

        $this->limites->assertOpenable($operateur->id, $organisationId);

        $maintenant = now();
        $acces = SupportAccessGrant::query()->create([
            'support_ticket_id' => $demande->id,
            'operator_user_id' => $operateur->id,
            'organization_id' => $organisationId,
            'kind' => SupportAccessKind::Emergency,
            'scopes' => [SupportAccessScope::Settings->value, SupportAccessScope::Team->value],
            'status' => SupportAccessStatus::Active,
            'emergency_basis' => $fondement,
            'reason' => $motif,
            'duration_hours' => SupportRules::ACCES_URGENCE_HEURES,
            'requested_at' => $maintenant,
            'decided_by_user_id' => $operateur->id,
            'decided_at' => $maintenant,
            'granted_at' => $maintenant,
            'expires_at' => $maintenant->copy()->addHours(SupportRules::ACCES_URGENCE_HEURES),
        ]);

        $this->audit->handle('messaging.support_access.emergency', subject: $acces, metadata: [
            'grant_id' => $acces->id,
            'ticket' => $demande->reference,
            'basis' => $fondement->value,
            'scopes' => $acces->scopes,
        ]);

        SupportAccessEmergencyOpened::dispatch($organisationId, $acces->id);

        return $acces;
    }
}
