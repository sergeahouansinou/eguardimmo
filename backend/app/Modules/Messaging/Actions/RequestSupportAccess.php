<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Enums\SupportAccessKind;
use App\Modules\Messaging\Enums\SupportAccessScope;
use App\Modules\Messaging\Enums\SupportAccessStatus;
use App\Modules\Messaging\Enums\TicketStatus;
use App\Modules\Messaging\Events\SupportAccessRequested;
use App\Modules\Messaging\Models\SupportAccessGrant;
use App\Modules\Messaging\Models\SupportTicket;
use App\Modules\Messaging\Support\SupportRules;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

/**
 * L'opérateur demande ; un `owner` ou `admin` de l'organisation décide. Une seule demande vivante par demande de support.
 */
final readonly class RequestSupportAccess
{
    public function __construct(private RecordAudit $audit) {}

    /**
     * @param  list<SupportAccessScope>  $scopes
     */
    public function handle(User $operateur, SupportTicket $ticket, array $scopes, string $motif, int $heures): SupportAccessGrant
    {
        if ($heures < 1 || $heures > SupportRules::ACCES_DUREE_MAX_HEURES) {
            throw ErrorCode::SupportAccessDurationInvalid->problem();
        }

        return DB::transaction(function () use ($operateur, $ticket, $scopes, $motif, $heures): SupportAccessGrant {
            $demande = SupportTicket::query()->whereKey($ticket->id)->lockForUpdate()->firstOrFail();

            if ($demande->organization_id === null) {
                throw ErrorCode::SupportAccessOrganizationRequired->problem();
            }

            if ($demande->status === TicketStatus::Resolved) {
                throw ErrorCode::TicketResolved->problem();
            }

            $ouverts = SupportAccessGrant::query()
                ->where('support_ticket_id', $demande->id)
                ->where('kind', SupportAccessKind::Consent)
                ->whereIn('status', [SupportAccessStatus::Requested, SupportAccessStatus::Active])
                ->get()
                ->contains(fn (SupportAccessGrant $acces): bool => $acces->status === SupportAccessStatus::Requested || $acces->isLive());

            if ($ouverts) {
                throw ErrorCode::SupportAccessAlreadyOpen->problem();
            }

            $acces = SupportAccessGrant::query()->create([
                'support_ticket_id' => $demande->id,
                'operator_user_id' => $operateur->id,
                'organization_id' => $demande->organization_id,
                'kind' => SupportAccessKind::Consent,
                'scopes' => array_values(array_unique(array_map(fn (SupportAccessScope $s): string => $s->value, $scopes))),
                'status' => SupportAccessStatus::Requested,
                'reason' => $motif,
                'duration_hours' => $heures,
                'requested_at' => now(),
            ]);

            $this->audit->handle('messaging.support_access.requested', subject: $acces, metadata: [
                'grant_id' => $acces->id,
                'ticket' => $demande->reference,
                'scopes' => $acces->scopes,
                'duration_hours' => $heures,
            ]);

            SupportAccessRequested::dispatch($demande->organization_id, $acces->id);

            return $acces;
        });
    }
}
