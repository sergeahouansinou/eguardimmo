<?php

declare(strict_types=1);

namespace App\Modules\Leases\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Leases\Data\ProofContext;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Enums\NoticeRequestEventKind;
use App\Modules\Leases\Enums\NoticeRequestStatus;
use App\Modules\Leases\Events\NoticeRequestAcknowledged;
use App\Modules\Leases\Jurisdictions\LeaseRegimes;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseNoticeRequest;
use App\Modules\Leases\Support\NoticeJournal;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class AcknowledgeNoticeRequest
{
    public function __construct(
        private LeaseRegimes $regimes,
        private NoticeJournal $journal,
        private RecordAudit $audit,
    ) {}

    /**
     * Le récépissé daté de l'agence : la date de réception est celle de la remise, jamais dans le futur ni avant le dépôt.
     * Elle recalcule le premier jour de départ possible. Rejouable avec la même date.
     */
    public function handle(LeaseNoticeRequest $demande, User $acteur, CarbonImmutable $recu, ProofContext $contexte): LeaseNoticeRequest
    {
        return DB::transaction(function () use ($demande, $acteur, $recu, $contexte): LeaseNoticeRequest {
            $verrouillee = LeaseNoticeRequest::query()->whereKey($demande->id)->lockForUpdate()->firstOrFail();

            if ($verrouillee->status === NoticeRequestStatus::Acknowledged && $verrouillee->received_on?->toDateString() === $recu->toDateString()) {
                return $verrouillee;
            }

            if ($verrouillee->status !== NoticeRequestStatus::Submitted) {
                throw ErrorCode::NoticeRequestLocked->problem();
            }

            if ($recu->toDateString() > CarbonImmutable::today()->toDateString() || $recu->toDateString() < $verrouillee->created_at->toDateString()) {
                throw ErrorCode::LeaseNoticeInvalid->problem('La date de réception ne peut pas être dans le futur ni précéder le dépôt de la demande.');
            }

            $bail = Lease::query()->findOrFail($verrouillee->lease_id);
            $regime = $this->regimes->for($bail->jurisdiction, $bail->regime_key);
            $premier = $regime->tenantEarliestDeparture($bail->jurisdiction_data, $recu, $verrouillee->reason_key);

            $verrouillee->forceFill([
                'status' => NoticeRequestStatus::Acknowledged,
                'received_on' => $recu->toDateString(),
                'earliest_departure_on' => $premier->toDateString(),
                'acknowledged_by_user_id' => $acteur->id,
                'acknowledged_at' => now(),
            ])->save();

            $this->journal->record($verrouillee, NoticeRequestEventKind::Acknowledged, $acteur->id, $contexte, data: ['received_on' => $recu->toDateString(), 'earliest_departure_on' => $premier->toDateString()]);
            $this->audit->handle('leases.notice_request.acknowledged', $acteur->id, ['received_on' => $recu->toDateString()], $verrouillee);
            NoticeRequestAcknowledged::dispatch($verrouillee->id, $verrouillee->lease_id, $verrouillee->organization_id, $verrouillee->party_id);

            return $verrouillee;
        });
    }
}
