<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Actions;

use App\Modules\Mandates\Data\OwnerVisibleData;
use App\Modules\Mandates\Enums\EndRequestStatus;
use App\Modules\Mandates\Enums\ErrorCode;
use App\Modules\Mandates\Enums\MandateStatus;
use App\Modules\Mandates\Events\MandateEndRequested;
use App\Modules\Mandates\Models\MandateEndRequest;
use App\Modules\Mandates\Queries\MandateEndRequests;
use App\Modules\Mandates\Queries\Mandates;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class RequestMandateEnd
{
    public function __construct(private Mandates $mandats, private MandateEndRequests $demandes, private RecordAudit $audit) {}

    /**
     * Demande seulement : le mandat n'est pas modifié, l'agence décide. Rejouée, la demande vivante est renvoyée sans second
     * événement ni second audit (`wasRecentlyCreated` distingue les deux cas). Suppose un contexte d'organisation.
     */
    public function handle(string $mandateId, OwnerVisibleData $visible, string $userId, ?string $reason): MandateEndRequest
    {
        return DB::transaction(function () use ($mandateId, $visible, $userId, $reason): MandateEndRequest {
            $mandat = $this->mandats->locked($mandateId);

            if ($mandat->archived_at !== null) {
                throw ErrorCode::MandateArchived->problem();
            }

            if ($mandat->status !== MandateStatus::Active) {
                throw ErrorCode::MandateNotActive->problem();
            }

            $existante = $this->demandes->pendingOf($mandat->id);

            if ($existante instanceof MandateEndRequest) {
                return $existante;
            }

            $demande = MandateEndRequest::query()->create([
                'mandate_id' => $mandat->id,
                'mandant_party_id' => $mandat->mandant_party_id,
                'access_id' => $visible->accessId,
                'requested_by_user_id' => $userId,
                'status' => EndRequestStatus::Pending,
                'reason' => $reason,
            ]);

            $this->audit->handle('mandates.end_request.created', $userId, ['reference' => $mandat->reference, 'access_id' => $visible->accessId, 'has_reason' => $reason !== null], $demande);

            MandateEndRequested::dispatch($mandat->organization_id, $mandat->id, $mandat->mandant_party_id, $demande->id, $mandat->reference);

            return $demande;
        });
    }
}
