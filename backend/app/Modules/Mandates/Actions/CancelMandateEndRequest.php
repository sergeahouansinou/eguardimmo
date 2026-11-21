<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Actions;

use App\Modules\Mandates\Enums\EndRequestStatus;
use App\Modules\Mandates\Enums\ErrorCode;
use App\Modules\Mandates\Models\MandateEndRequest;
use App\Modules\Mandates\Queries\MandateEndRequests;
use App\Modules\Mandates\Queries\Mandates;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class CancelMandateEndRequest
{
    public function __construct(private Mandates $mandats, private MandateEndRequests $demandes, private RecordAudit $audit) {}

    /**
     * Suppose un contexte d'organisation. Sans demande vivante : mandate_end_request_not_found (404).
     */
    public function handle(string $mandateId, string $userId): MandateEndRequest
    {
        return DB::transaction(function () use ($mandateId, $userId): MandateEndRequest {
            $mandat = $this->mandats->locked($mandateId);
            $demande = $this->demandes->lockedPendingOf($mandat->id) ?? throw ErrorCode::MandateEndRequestNotFound->problem();

            $demande->status = EndRequestStatus::Cancelled;
            $demande->cancelled_at = now();
            $demande->save();

            $this->audit->handle('mandates.end_request.cancelled', $userId, ['reference' => $mandat->reference], $demande);

            return $demande;
        });
    }
}
