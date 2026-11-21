<?php

declare(strict_types=1);

namespace App\Modules\Leases\Queries;

use App\Modules\Leases\Data\TenantStandingData;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Enums\NoticeRequestStatus;
use App\Modules\Leases\Jurisdictions\LeaseRegimes;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseNoticeRequest;
use App\Modules\Leases\Support\NoticeOptionsView;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;

final readonly class NoticeOptions
{
    public function __construct(
        private LeaseRegimes $regimes,
        private CurrentOrganization $contexte,
    ) {}

    public function forTenant(TenantStandingData $position, CarbonImmutable $today): NoticeOptionsView
    {
        return $this->contexte->run($position->organizationId, function () use ($position, $today): NoticeOptionsView {
            $bail = Lease::query()->findOrFail($position->leaseId);
            $supporte = $this->regimes->supports($bail->jurisdiction, $bail->regime_key);
            $motifs = $supporte ? $this->regimes->for($bail->jurisdiction, $bail->regime_key)->tenantNoticeReasons($bail->jurisdiction_data) : [];
            $regime = $supporte ? $this->regimes->for($bail->jurisdiction, $bail->regime_key) : null;

            $premiers = [];
            foreach ($motifs as $motif) {
                $premiers[$motif->key] = $regime?->tenantEarliestDeparture($bail->jurisdiction_data, $today, $motif->key) ?? $today;
            }

            $indisponibilite = $this->indisponibilite($position, $bail, $supporte, $motifs === []);

            return new NoticeOptionsView(
                $indisponibilite === null,
                $indisponibilite,
                $motifs,
                $premiers,
                (string) config('leases.notice.consent_version'),
                (string) config('leases.notice.consent_text'),
                (string) config('leases.notice.legal_notice'),
                (bool) config('leases.notice.to_confirm'),
            );
        });
    }

    private function indisponibilite(TenantStandingData $position, Lease $bail, bool $supporte, bool $sansMotif): ?string
    {
        return match (true) {
            ! $supporte => 'lease_jurisdiction_unsupported',
            ! $position->active, $bail->status !== LeaseStatus::Signed, $bail->archived_at !== null, $bail->notice_received_on !== null => 'lease_notice_not_allowed',
            LeaseNoticeRequest::query()->where('lease_id', $bail->id)->where('party_id', $position->partyId)->whereIn('status', [NoticeRequestStatus::Submitted->value, NoticeRequestStatus::Acknowledged->value])->exists() => 'notice_request_exists',
            $sansMotif => 'notice_reason_unsupported',
            default => null,
        };
    }
}
