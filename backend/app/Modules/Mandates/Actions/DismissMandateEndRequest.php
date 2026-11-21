<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Actions;

use App\Modules\Mandates\Enums\EndRequestStatus;
use App\Modules\Mandates\Enums\ErrorCode;
use App\Modules\Mandates\Events\MandateEndRequestDecided;
use App\Modules\Mandates\Models\MandateEndRequest;
use App\Modules\Mandates\Queries\MandateEndRequests;
use App\Modules\Mandates\Queries\Mandates;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class DismissMandateEndRequest
{
    public function __construct(private Mandates $mandats, private MandateEndRequests $demandes, private RecordAudit $audit) {}

    /**
     * Rejette la demande vivante : le mandat n'est pas modifié. Rejouée, la demande déjà rejetée est renvoyée sans second
     * événement ni second audit. Sans aucune demande : mandate_end_request_not_found (404) ; dernière demande annulée ou
     * satisfaite : mandate_end_request_not_pending (409). Suppose un contexte d'organisation.
     */
    public function handle(string $mandateId, string $userId, ?string $note): MandateEndRequest
    {
        return DB::transaction(function () use ($mandateId, $userId, $note): MandateEndRequest {
            $mandat = $this->mandats->locked($mandateId);
            $demande = $this->demandes->lockedLatestOf($mandat->id) ?? throw ErrorCode::MandateEndRequestNotFound->problem();

            if ($demande->status === EndRequestStatus::Dismissed) {
                return $demande;
            }

            if ($demande->status !== EndRequestStatus::Pending) {
                throw ErrorCode::MandateEndRequestNotPending->problem();
            }

            $demande->status = EndRequestStatus::Dismissed;
            $demande->decided_at = now();
            $demande->decided_by_user_id = $userId;
            $demande->decision_note = $note;
            $demande->save();

            $this->audit->handle('mandates.end_request.dismissed', $userId, ['reference' => $mandat->reference, 'has_note' => $note !== null], $demande);

            MandateEndRequestDecided::dispatch($mandat->organization_id, $mandat->id, $mandat->mandant_party_id, $demande->id, $mandat->reference, EndRequestStatus::Dismissed);

            return $demande;
        });
    }
}
